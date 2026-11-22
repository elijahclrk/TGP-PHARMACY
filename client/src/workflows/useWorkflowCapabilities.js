import {useAuth} from '../auth/auth-context'
export function useWorkflowCapabilities(){return useAuth().workflowCapabilities||{loading:false,enabled:false,restocking:false}}
