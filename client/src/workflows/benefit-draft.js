// Identity stays in component memory; checkout recovery stores an opaque reference.
export const emptyBenefitDraft=()=>({benefit:'regular',customer:{name:'',id:'',idType:'osca'},documents:{identitySeen:false,entitlementConfirmed:false,exclusiveUse:false,bookletSeen:false,purchaser:'self'}})
