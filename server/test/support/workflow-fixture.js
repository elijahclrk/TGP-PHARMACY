// Transactional in-memory SQL double. Serialization models row locks; it does
// not certify PostgreSQL concurrency, triggers or deferred COMMIT constraints.
export function workflowFixture() {
  let state = {
    users: [{user_id:1,role:'employee',status:'active'},{user_id:2,role:'admin',status:'active'},{user_id:3,role:'manager',status:'active'},{user_id:4,role:'employee',status:'inactive'}],
    batches:[{batch_id:10,qty_on_hand:5,expiry_date:'2099-01-01'}],
    sale_items:[{sale_item_id:20,sale_id:30,batch_id:10,quantity:5}],
    sales:[{sale_id:30,qualified:true}],
    stock_adjustments:[],sale_returns:[],return_dispositions:[],activity_logs:[],
    pharmacist_authorizations:[{authorization_id:40,user_id:2,revoked_at:null,valid:true}],
  };
  const calls = []; let gate = Promise.resolve(), auditFails = false, commitFails = false, lostCommit = false;
  const result = rows => ({rows:structuredClone(rows),rowCount:rows.length});
  const provider = () => ({async connect() {
    const previous = gate; let unlock; gate = new Promise(resolve => { unlock=resolve; }); await previous;
    let snapshot;
    return {release:unlock,async query(sql, p=[]) {
      calls.push({sql,p});
      if (sql==='BEGIN') { snapshot=structuredClone(state); return result([]); }
      if (sql==='ROLLBACK') { state=snapshot; return result([]); }
      if (sql==='COMMIT') { if(commitFails)throw Error('Synthetic commit failure');if(lostCommit){snapshot=structuredClone(state);lostCommit=false;throw Error('Synthetic lost COMMIT acknowledgement');}return result([]); }
      if(sql.startsWith('SELECT pg_advisory'))return result([]);
      if(sql==='SELECT CURRENT_TIMESTAMP AS now')return result([{now:'2026-11-21T04:00:00Z'}]);
      if(sql.startsWith('INSERT INTO activity_logs')) { if(auditFails)throw Error('Synthetic audit failure');state.activity_logs.push({log_id:p[0],user_id:p[1],action:p[2]});return result([{log_id:p[0]}]); }
      if(sql.startsWith('SELECT COALESCE(sum(quantity),0)')) {
        const table=sql.includes('FROM sale_returns')?'sale_returns':'return_dispositions',fk=table==='sale_returns'?'sale_item_id':'return_id';
        return result([{used:String(state[table].filter(r=>r[fk]===p[0]&&r.decision_state==='approved').reduce((a,r)=>a+r.quantity,0))}]);
      }
      if(sql.startsWith('SELECT ')) {
        if(sql.startsWith('SELECT s.sale_id FROM sales s'))return result(state.sales.filter(r=>r.sale_id===p[0]&&r.qualified));
        const table=sql.match(/FROM (\w+)/)?.[1]; if(!state[table])throw Error('Unhandled fixture SELECT');
        let rows=state[table];
        const by=sql.match(/WHERE (\w+)=\$1/);if(by)rows=rows.filter(r=>r[by[1]]===p[0]);
        if(sql.includes('AND sale_id=$2'))rows=rows.filter(r=>r.sale_id===p[1]);
        if(table==='pharmacist_authorizations')rows=rows.filter(r=>r.user_id===p[1]&&!r.revoked_at&&r.valid);
        if(sql.includes('AND expiry_date>'))rows=rows.filter(r=>r.expiry_date&&r.expiry_date>'2026-11-21');
        return result(rows);
      }
      if(sql.startsWith('INSERT INTO stock_adjustments')) {
        const row={adjustment_id:p[0],batch_id:p[1],adjusted_by:p[2],quantity:p[3],reason:p[4],request_key:p[5],decision_state:'pending',origin_kind:sql.includes("'return_restock'")?'return_restock':'manual',return_disposition_id:p[6]??null};
        state.stock_adjustments.push(row);return result([row]);
      }
      if(sql.startsWith('INSERT INTO sale_returns')) {
        const row={return_id:p[0],sale_id:p[1],sale_item_id:p[2],processed_by:p[3],quantity:p[4],reason:p[5],request_key:p[6],decision_state:'pending',received_quantity:0};state.sale_returns.push(row);return result([row]);
      }
      if(sql.startsWith('INSERT INTO return_dispositions')) {
        const row={disposition_id:p[0],return_id:p[1],request_key:p[2],action:p[3],quantity:p[4],requested_by:p[5],reason:p[6],decision_state:'pending'};state.return_dispositions.push(row);return result([row]);
      }
      if(sql.startsWith('UPDATE batches')) {
        const row=state.batches.find(r=>r.batch_id===p[0]&&r.qty_on_hand===p[2]);if(!row)return result([]);row.qty_on_hand=p[1];return result([row]);
      }
      if(sql.startsWith('UPDATE sale_returns SET received_quantity')) {
        const row=state.sale_returns.find(r=>r.return_id===p[0]&&r.received_quantity===0);if(!row)return result([]);row.received_quantity=row.quantity;row.received_by=p[1];return result([row]);
      }
      if(sql.startsWith('UPDATE ')) {
        const table=sql.match(/^UPDATE (\w+)/)[1],pk={stock_adjustments:'adjustment_id',sale_returns:'return_id',return_dispositions:'disposition_id'}[table];
        const row=state[table].find(r=>r[pk]===p[0]&&r.decision_state==='pending');if(!row)return result([]);
        Object.assign(row,{decision_state:p[1],reviewed_by:p[2],decision_reason:p[3]});
        if(table!=='return_dispositions')row.approved_by=p[1]==='approved'?p[2]:null;
        for(const [,field,n]of sql.matchAll(/,(\w+)=\$(\d+)/g))row[field]=p[Number(n)-1];
        return result([row]);
      }
      throw Error('Unhandled fixture SQL');
    }};
  }});
  return {provider,calls,get state(){return state;},failAudit(){auditFails=true;},failCommit(){commitFails=true;},loseCommit(){lostCommit=true;}};
}
