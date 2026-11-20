import Workspace from '../components/Workspace'
import ReportPanel from '../reports/ReportPanel'
export default function Reports() {
  return <Workspace><h1 className="text-3xl font-bold">Reports</h1><p className="mt-3 text-slate-600">Read-only sales and inventory summaries. Amounts are shown in PHP.</p><ReportPanel/></Workspace>
}
