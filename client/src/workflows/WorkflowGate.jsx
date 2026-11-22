import {useWorkflowCapabilities} from './useWorkflowCapabilities'
export default function WorkflowGate({children}){const c=useWorkflowCapabilities();if(c.loading)return <p role="status">Checking workflow availability…</p>;if(!c.enabled)return <p role="status">Controlled inventory workflows are unavailable. Contact an administrator.</p>;return children}
