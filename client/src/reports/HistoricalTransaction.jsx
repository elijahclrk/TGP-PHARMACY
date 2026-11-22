import {useInventory} from '../inventory/useInventory'
import {Receipt} from '../pages/Pos'
import Modal from '../components/Modal'
export default function HistoricalTransaction({id,onClose}){
 const result=useInventory(`/pos/sales/${id}`,0)
 if(result.data?.data)return <Receipt historical data={result.data.data} onClose={onClose}/>
 return <Modal title="Historical transaction" onClose={onClose}>{result.error?<p role="alert">{result.error}</p>:<p role="status">Loading historical transaction...</p>}</Modal>
}
