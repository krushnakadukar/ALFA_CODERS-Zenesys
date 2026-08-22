import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
type View = "dashboard" | "requests" | "tracking" | "approvals" | "resources" | "analytics" | "governance" | "ai" | "org";
type Session = { accessToken: string; refreshToken: string; user: { employeeId: string; roleName: string; permissions: string[] } };
type RequestRecord = { id: string; employeeId?: string; requestType: string; status: string; priority: string; title: string; reason?: string; createdAt: string; employee?: any; currentOwner?: any; context?: any[]; approvals?: any[]; attachments?: any[]; auditLogs?: any[] };
type AttachmentUpload = { fileName: string; mimeType: string; contentBase64: string; isRequired: boolean };
type ApprovalDecision = "approve" | "reject" | "send-back";
type NavItem = { view: View; label: string };
type DashboardKind = "employee" | "manager" | "hr" | "finance" | "departmentHead";

const mvpRequestTypes = ["Leave", "Expense", "Asset Request", "Resource Request", "Work From Home"];
const requestFormConfig: Record<string, Array<{ key: string; label: string; type?: string; options?: string[] }>> = {
  Leave: [
    { key: "leaveType", label: "Leave type", options: ["Annual", "Sick", "Casual"] },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" }
  ],
  Expense: [
    { key: "amount", label: "Amount", type: "number" },
    { key: "category", label: "Category", options: ["Travel", "Internet", "Client meal", "Office supplies"] },
    { key: "receipt", label: "Receipt reference" }
  ],
  "Asset Request": [
    { key: "assetCategory", label: "Asset category", options: ["Laptop", "Monitor", "Phone", "Software license"] },
    { key: "amount", label: "Estimated value", type: "number" },
    { key: "businessNeed", label: "Business need" }
  ],
  "Resource Request": [
    { key: "requiredSkill", label: "Required skill", options: ["React", "Node.js", "Testing", "DevOps", "Financial Analysis"] },
    { key: "requiredRole", label: "Required role", options: ["Developer", "Tester", "DevOps Engineer", "Finance Analyst"] },
    { key: "allocationPct", label: "Allocation %", type: "number" }
  ],
  "Work From Home": [
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" },
    { key: "meetings", label: "Meetings / coverage plan" }
  ]
};

const requestDefaults: Record<string, Record<string, string>> = {
  Leave: { leaveType: "Annual", startDate: "2026-09-10", endDate: "2026-09-13" },
  Expense: { amount: "18500", category: "Travel", receipt: "Receipt uploaded offline" },
  "Asset Request": { assetCategory: "Laptop", amount: "65000", businessNeed: "Required for project delivery" },
  "Resource Request": { requiredSkill: "React", requiredRole: "Developer", allocationPct: "50" },
  "Work From Home": { startDate: "2026-09-10", endDate: "2026-09-10", meetings: "Available on Slack and calls" }
};

const baseNav: NavItem[] = [
  { view: "dashboard", label: "Dashboard" },
  { view: "requests", label: "Requests" },
  { view: "tracking", label: "Tracking" },
  { view: "ai", label: "AI Intake" },
  { view: "org", label: "Organization" }
];

function hasPermission(session: Session | null, permission: string) {
  return Boolean(session?.user.permissions.includes(permission));
}

function roleNav(session: Session | null, approvalCount: number): NavItem[] {
  const canManageTeam = hasPermission(session, "employee:read:team") || hasPermission(session, "employee:read:any");
  const canReadAnalytics = hasPermission(session, "analytics:read");
  const canManageAdmin = hasPermission(session, "admin:manage");
  const nav = [...baseNav];

  if (approvalCount > 0 || canManageTeam) nav.splice(3, 0, { view: "approvals", label: "Approvals" });
  if (canManageTeam) nav.splice(nav.findIndex((item) => item.view === "ai"), 0, { view: "resources", label: "Resources" });
  if (canReadAnalytics) nav.splice(nav.findIndex((item) => item.view === "ai"), 0, { view: "analytics", label: "Analytics" });
  if (canManageAdmin) nav.splice(nav.findIndex((item) => item.view === "ai"), 0, { view: "governance", label: "Governance" });

  return nav;
}

function dashboardKind(me: any, session: Session | null): DashboardKind {
  const role = String(me?.role?.name ?? session?.user.roleName ?? "").toLowerCase();
  const designation = String(me?.designation ?? "").toLowerCase();
  const department = String(me?.department?.name ?? "").toLowerCase();
  if (role.includes("department head")) return "departmentHead";
  if (department.includes("finance") || designation.includes("finance") || role === "cfo") return "finance";
  if (department.includes("human resources") || designation.includes("hr") || role === "chro") return "hr";
  if (role.includes("manager") || role.includes("team lead")) return "manager";
  return "employee";
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [me, setMe] = useState<any>(null);
  const [orgTree, setOrgTree] = useState<any>(null);
  const [requestTypes, setRequestTypes] = useState<any[]>([]);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [governance, setGovernance] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const selected = requests.find((item) => item.id === selectedId) ?? requests[0];
  const navigation = useMemo(() => roleNav(session, approvals.length), [session, approvals.length]);
  const canSeeResources = navigation.some((item) => item.view === "resources");
  const canSeeGovernance = navigation.some((item) => item.view === "governance");
  const currentDashboard = dashboardKind(me, session);

  const clearSession = useCallback((message?: string) => {
    localStorage.removeItem("orgflow-session");
    setSession(null);
    setMe(null);
    if (message) setError(message);
  }, []);

  const api = useMemo(() => makeApi(session, clearSession), [session, clearSession]);

  async function refreshAll() {
    if (!session) return;
    setError(null);
    try {
      const canLoadResources = hasPermission(session, "employee:read:team") || hasPermission(session, "employee:read:any");
      const canLoadGovernance = hasPermission(session, "admin:manage");
      const [meData, treeData, typeData, requestData, approvalData, resourceData, recData, analyticsData, governanceData] = await Promise.all([
        api("/auth/me"),
        api("/org/tree"),
        api("/request-types"),
        api("/requests"),
        api("/approvals/inbox"),
        canLoadResources ? api("/resources") : Promise.resolve({ resources: [] }),
        canLoadResources ? api("/resource-allocation/recommendations", { method: "POST", body: JSON.stringify({ skill: "React" }) }) : Promise.resolve({ recommendations: [] }),
        api("/analytics"),
        canLoadGovernance ? api("/governance") : Promise.resolve(null)
      ]);
      setMe(meData.employee);
      setOrgTree(treeData);
      setRequestTypes(typeData.requestTypes);
      setRequests(requestData.requests);
      setApprovals(approvalData.approvals);
      setResources(resourceData.resources);
      setRecommendations(recData.recommendations);
      setAnalytics(analyticsData);
      setGovernance(governanceData);
      setSelectedId((current) => current || requestData.requests[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load persisted workflow data");
    }
  }

  useEffect(() => {
    localStorage.removeItem("orgflow-session");
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [session]);

  useEffect(() => {
    if (!navigation.some((item) => item.view === view)) setView("dashboard");
  }, [navigation, view]);

  async function login(email: string, password: string) {
    const next = await makeApi(null)("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    setSession(next);
  }

  async function submitRequest(payload: Record<string, unknown>, attachment?: AttachmentUpload) {
    const created = await api("/requests", { method: "POST", body: JSON.stringify(payload) });
    if (attachment) {
      await api(`/requests/${created.request.id}/attachments`, { method: "POST", body: JSON.stringify(attachment) });
    }
    setSelectedId(created.request.id);
    setView("requests");
    await refreshAll();
  }

  async function decide(approvalId: string, decision: ApprovalDecision, comments?: string) {
    const defaultComment = decision === "send-back" ? "Please provide more information for this request." : `${decision} from workflow console`;
    await api(`/approvals/${approvalId}/${decision}`, { method: "POST", body: JSON.stringify({ comments: comments?.trim() || defaultComment }) });
    await refreshAll();
  }

  if (!session) return <Login onLogin={login} error={error} setError={setError} />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div><p className="eyebrow">OrgFlow</p><h1>Workflow OS</h1><p className="sidebar-copy">Employee workflow management.</p></div>
        <nav>{navigation.map((item) => <button key={item.view} className={view === item.view ? "nav-active" : ""} onClick={() => setView(item.view)}>{item.label}</button>)}</nav>
        <button className="ghost-button" onClick={() => clearSession()}>Sign out</button>
      </aside>
      <section className="content">
        {error && <div className="alert">{error}</div>}
        <Header me={me} analytics={analytics} approvals={approvals} />
        {view === "dashboard" && <Dashboard kind={currentDashboard} me={me} analytics={analytics} requests={requests} approvals={approvals} recommendations={recommendations} open={(id) => { setSelectedId(id); setView("requests"); }} go={setView} />}
        {view === "requests" && <Requests requests={requests} selected={selected} requestTypes={requestTypes} select={setSelectedId} submit={submitRequest} />}
        {view === "tracking" && <Tracking requests={requests} selected={selected} select={setSelectedId} />}
        {view === "approvals" && <Approvals approvals={approvals} decide={decide} />}
        {view === "resources" && canSeeResources && <Resources resources={resources} recommendations={recommendations} />}
        {view === "analytics" && <Analytics analytics={analytics} governance={governance} />}
        {view === "governance" && canSeeGovernance && <Governance governance={governance} />}
        {view === "ai" && <Assistant api={api} />}
        {view === "org" && <Org orgTree={orgTree} me={me} />}
      </section>
    </main>
  );
}

function Login({ onLogin, error, setError }: { onLogin: (email: string, password: string) => Promise<void>; error: string | null; setError: (value: string | null) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return <main className="login-screen"><form className="login-panel" onSubmit={(event) => { event.preventDefault(); setError(null); onLogin(email, password).catch((err) => setError(err.message)); }}><p className="eyebrow">OrgFlow</p><h1>Employee Workflow</h1><p className="muted">This login now requires the API and MySQL seed. Demo password: OrgFlow@123.</p><label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="alert">{error}</div>}<button type="submit">Sign in</button></form></main>;
}

function Header({ me, analytics, approvals }: { me: any; analytics: any; approvals: any[] }) {
  return <section className="profile-band"><div><p className="eyebrow">Signed in</p><h2>{me?.name ?? "Waiting for API"}</h2><p>{me?.designation ?? "Configure MySQL and start the API"} · {me?.role?.name ?? ""}</p></div><Metric label="Open requests" value={String(analytics?.openRequests ?? 0)} /><Metric label="Pending approvals" value={String(approvals.length)} /><Metric label="Escalated" value={String(analytics?.escalated ?? 0)} tone="warn" /></section>;
}

function Dashboard({ kind, me, analytics, requests, approvals, recommendations, open, go }: { kind: DashboardKind; me: any; analytics: any; requests: RequestRecord[]; approvals: any[]; recommendations: any[]; open: (id: string) => void; go: (view: View) => void }) {
  const myRequests = requests.filter((request) => request.employee?.id === me?.id || request.employeeId === me?.id);
  const pendingRequests = requests.filter((request) => request.status.includes("Pending"));
  const expenseApprovals = approvals.filter((approval) => ["Expense", "Expense Reimbursement"].includes(approval.request.requestType));
  const pendingTransactionValue = expenseApprovals.reduce((sum, approval) => sum + contextAmount(approval.request.context), 0);
  const overloaded = recommendations.filter((item) => item.allocation > 90).length;

  if (kind === "finance") {
    return <><DashboardHero title="Finance Manager Dashboard" me={me} go={go} /><div className="metric-grid"><Metric label="Pending expense approvals" value={String(expenseApprovals.length)} /><Metric label="Pending transaction value" value={`₹${pendingTransactionValue.toLocaleString("en-IN")}`} /><Metric label="Reimbursements tracked" value={String(requests.filter((item) => item.requestType.includes("Expense")).length)} /><Metric label="My open requests" value={String(myRequests.length)} /></div><div className="dashboard-grid"><ProfilePanel me={me} /><LeaveBalancePanel me={me} /><section><div className="section-heading"><h2>Finance Queue</h2><span>expense approvals</span></div><div className="list">{expenseApprovals.map((approval) => <ApprovalMini key={approval.id} approval={approval} go={go} />)}</div></section><NotificationPanel requests={myRequests} /></div></>;
  }

  if (kind === "hr") {
    return <><DashboardHero title="HR Admin Dashboard" me={me} go={go} /><div className="metric-grid"><Metric label="Company pending requests" value={String(pendingRequests.length)} /><Metric label="Open requests" value={String(analytics?.openRequests ?? 0)} /><Metric label="Unread notices" value={String(analytics?.unreadNotifications ?? 0)} /><Metric label="Escalated" value={String(analytics?.escalated ?? 0)} tone="warn" /></div><div className="dashboard-grid"><ProfilePanel me={me} /><LeaveBalancePanel me={me} /><section><div className="section-heading"><h2>Company Pending Requests</h2><span>{pendingRequests.length}</span></div><div className="list">{pendingRequests.map((request) => <RequestRow key={request.id} request={request} onClick={() => open(request.id)} />)}</div></section><NotificationPanel requests={myRequests} /></div></>;
  }

  if (kind === "departmentHead") {
    return <><DashboardHero title="Department Head Dashboard" me={me} go={go} /><div className="metric-grid"><Metric label="High level approvals" value={String(approvals.length)} /><Metric label="Overloaded employees" value={String(overloaded)} tone="warn" /><Metric label="Approval bottlenecks" value={String(analytics?.bottlenecks?.length ?? 0)} /><Metric label="My requests" value={String(myRequests.length)} /></div><div className="dashboard-grid"><ProfilePanel me={me} /><LeaveBalancePanel me={me} /><section><div className="section-heading"><h2>High Level Requests</h2><span>approve / reject</span></div><div className="list">{approvals.map((approval) => <ApprovalMini key={approval.id} approval={approval} go={go} />)}</div></section><section><div className="section-heading"><h2>Approval Bottlenecks</h2><span>monitor</span></div><div className="signal-list">{(analytics?.bottlenecks ?? []).map((item: any) => <Signal key={item.stage} title={`${item.stage} bottleneck`} body={`${item.count} approval(s), average ${item.averageHours} hours`} />)}</div></section></div></>;
  }

  if (kind === "manager") {
    return <><DashboardHero title="Manager Dashboard" me={me} go={go} /><div className="metric-grid"><Metric label="Pending approvals" value={String(approvals.length)} /><Metric label="Team utilization records" value={String(recommendations.length)} /><Metric label="Overloaded team members" value={String(overloaded)} tone="warn" /><Metric label="My open requests" value={String(myRequests.length)} /></div><div className="dashboard-grid"><ProfilePanel me={me} /><LeaveBalancePanel me={me} /><section><div className="section-heading"><h2>Team Members & Utilization</h2><span>resource load</span></div><div className="utilization-grid compact">{recommendations.slice(0, 6).map((item) => <UtilizationCard key={item.employee.id} item={item} />)}</div></section><section><div className="section-heading"><h2>Pending Requests</h2><span>approve / reject / send back</span></div><div className="list">{approvals.map((approval) => <ApprovalMini key={approval.id} approval={approval} go={go} />)}</div></section></div></>;
  }

  return <><DashboardHero title="Employee Dashboard" me={me} go={go} /><div className="metric-grid"><Metric label="My requests" value={String(myRequests.length)} /><Metric label="Pending approvals" value={String(approvals.length)} /><Metric label="Open requests" value={String(analytics?.openRequests ?? 0)} /><Metric label="Notifications" value={String(analytics?.unreadNotifications ?? 0)} /></div><div className="dashboard-grid"><ProfilePanel me={me} /><LeaveBalancePanel me={me} /><section><div className="section-heading"><h2>Track My Requests</h2><span>{myRequests.length}</span></div><div className="list">{myRequests.map((request) => <RequestRow key={request.id} request={request} onClick={() => open(request.id)} />)}</div></section><NotificationPanel requests={myRequests} /></div></>;
}

function DashboardHero({ title, me, go }: { title: string; me: any; go: (view: View) => void }) {
  return <section className="dashboard-hero"><div><p className="eyebrow">{title}</p><h2>{me?.name ?? "Signed in user"}</h2><p>{me?.designation ?? "Employee"} · {me?.department?.name ?? "Corporate"}</p></div><div className="button-row"><button onClick={() => go("requests")}>Apply Request</button><button onClick={() => go("tracking")}>Track Request</button><button onClick={() => go("ai")}>AI Intake</button></div></section>;
}

function ProfilePanel({ me }: { me: any }) {
  return <section><div className="section-heading"><h2>Personal Profile</h2><span>{me?.id}</span></div><div className="detail"><h3>{me?.name}</h3><p>{me?.designation}</p><dl><div><dt>Department</dt><dd>{me?.department?.name ?? "Corporate"}</dd></div><div><dt>Team</dt><dd>{me?.team?.name ?? "None"}</dd></div><div><dt>Manager</dt><dd>{me?.manager?.name ?? "None"}</dd></div><div><dt>Role</dt><dd>{me?.role?.name ?? "Employee"}</dd></div></dl></div></section>;
}

function LeaveBalancePanel({ me }: { me: any }) {
  return <section><div className="section-heading"><h2>Leave Balance</h2><span>available</span></div><div className="leave-grid">{(me?.leaveBalances ?? []).map((item: any) => <div key={item.id}><strong>{Number(item.availableDays)}</strong><span>{item.leaveType}</span><small>{Number(item.usedDays)} used · {Number(item.pendingDays)} pending</small></div>)}</div></section>;
}

function NotificationPanel({ requests }: { requests: RequestRecord[] }) {
  const updates = requests.filter((request) => ["Approved", "Rejected", "Sent Back", "Information Requested"].includes(request.status));
  return <section><div className="section-heading"><h2>Approval Notifications</h2><span>{updates.length}</span></div><div className="signal-list">{updates.length ? updates.map((request) => <Signal key={request.id} title={`${request.id} · ${request.status}`} body={`${request.title} · ${request.requestType}`} />) : <div className="hint">No approval or rejection notifications yet.</div>}</div></section>;
}

function ApprovalMini({ approval, go }: { approval: any; go: (view: View) => void }) {
  return <button className="row-button" onClick={() => go("approvals")}><span><strong>{approval.request.title}</strong><small>{approval.request.employee?.name} · {approval.request.requestType} · {approval.stage}</small></span><Status status={approval.status} /></button>;
}

function contextAmount(context: any[] = []) {
  const amountText = context.find((item: any) => String(item.key).includes("amount"))?.value ?? "";
  const amount = Number(String(amountText).replace(/[^\d.]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function Requests({ requests, selected, requestTypes, select, submit }: { requests: RequestRecord[]; selected?: RequestRecord; requestTypes: any[]; select: (id: string) => void; submit: (payload: Record<string, unknown>, attachment?: AttachmentUpload) => Promise<void> }) {
  return <div className="three-col"><section><div className="section-heading"><h2>Requests</h2><span>{requests.length}</span></div><div className="list">{requests.map((request) => <RequestRow key={request.id} request={request} active={selected?.id === request.id} onClick={() => select(request.id)} />)}</div></section><RequestDetail request={selected} /><NewRequest requestTypes={requestTypes} submit={submit} /></div>;
}

function NewRequest({ requestTypes, submit }: { requestTypes: any[]; submit: (payload: Record<string, unknown>, attachment?: AttachmentUpload) => Promise<void> }) {
  const requestOptions = requestTypes.filter((item) => mvpRequestTypes.includes(item.type));
  const [type, setType] = useState("Leave");
  const [title, setTitle] = useState("Annual leave request");
  const [reason, setReason] = useState("Submitted from workflow console");
  const [fields, setFields] = useState<Record<string, string>>(requestDefaults.Leave);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const schema = requestTypes.find((item) => item.type === type);
  const formFields = requestFormConfig[type] ?? [];
  const needsAttachment = attachmentRequired(type, fields, schema);
  useEffect(() => {
    setFields(requestDefaults[type] ?? {});
    setTitle(defaultTitle(type));
    setAttachmentFile(null);
  }, [type]);
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (needsAttachment && !attachmentFile) throw new Error("Please attach the required supporting document.");
      const attachment = attachmentFile
        ? {
            fileName: attachmentFile.name,
            mimeType: attachmentFile.type || "application/octet-stream",
            contentBase64: await fileToBase64(attachmentFile),
            isRequired: needsAttachment
          }
        : undefined;
      await submit({ type, title, reason, priority: requestPriority(type, fields), ...normalizeRequestFields(fields) }, attachment);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Request submit failed");
    } finally {
      setSubmitting(false);
    }
  }
  return <section><div className="section-heading"><h2>New Request</h2><span>{type}</span></div><form className="form-stack" onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}><label>Request type<select value={type} onChange={(event) => setType(event.target.value)}>{requestOptions.map((item) => <option key={item.type}>{item.type}</option>)}</select></label><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><div className="request-field-grid">{formFields.map((field) => <label key={field.key}>{field.label}{field.options ? <select value={fields[field.key] ?? ""} onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : <input type={field.type ?? "text"} value={fields[field.key] ?? ""} onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))} />}</label>)}</div><label>Reason<input value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="attachment-box"><label>{needsAttachment ? "Required attachment" : "Attachment"}<input type="file" onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)} /></label><span>{attachmentFile ? attachmentFile.name : needsAttachment ? "Attach bill, receipt, proof, or supporting document." : "Optional supporting document."}</span></div><div className="hint">{schema?.route ?? "Routes by policy"}</div><div className={needsAttachment ? "proof required" : "proof"}>{needsAttachment ? "Required" : schema?.proof ?? "Proof optional"}</div>{submitError && <div className="alert">{submitError}</div>}<button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit request"}</button></form></section>;
}

function RequestDetail({ request }: { request?: RequestRecord }) {
  if (!request) return <section><p className="muted">No request selected.</p></section>;
  return <section><div className="section-heading"><h2>{request.id}</h2><Status status={request.status} /></div><h3>{request.title}</h3><p className="muted">{request.requestType} · {request.priority} · Owner {request.currentOwner?.name ?? "Unassigned"}</p><div className="context-grid">{(request.context ?? []).map((item: any) => <div key={`${item.key}-${item.id}`}><span>{item.sourceType}</span><strong>{pretty(item.key)}</strong><p>{item.value}</p></div>)}</div><AttachmentList attachments={request.attachments ?? []} /><h4>Timeline</h4><ol className="timeline">{(request.auditLogs ?? []).map((item: any) => <li key={item.id}><strong>{item.eventType}</strong><span>{formatDate(item.eventAt)} · {item.actor?.name ?? "System"}</span><p>{item.details}</p></li>)}</ol></section>;
}

function Tracking({ requests, selected, select }: { requests: RequestRecord[]; selected?: RequestRecord; select: (id: string) => void }) {
  return <div className="grid"><section><div className="section-heading"><h2>Request Tracking</h2><span>{requests.length} requests</span></div><div className="list">{requests.map((request) => <RequestRow key={request.id} request={request} active={selected?.id === request.id} onClick={() => select(request.id)} />)}</div></section><section><div className="section-heading"><h2>{selected?.id ?? "No request"} Lifecycle</h2>{selected && <Status status={selected.status} />}</div><div className="stage-track">{["Submitted", "Validated", "Pending Approval", "Processing", "Completed"].map((stage) => <div key={stage} className={stageClass(stage, selected?.status)}><strong>{stage}</strong><span>{stageHint(stage, selected)}</span></div>)}</div><div className="sla-panel"><Metric label="Current owner" value={selected?.currentOwner?.name ?? "None"} /><Metric label="SLA consumed" value={selected?.status === "Escalated" ? "100%" : "62%"} tone={selected?.status === "Escalated" ? "warn" : undefined} /><Metric label="Risk state" value={selected?.status === "Escalated" ? "Escalated" : selected?.priority === "High" ? "At Risk" : "Normal"} /></div><RequestDetail request={selected} /></section></div>;
}

function Approvals({ approvals, decide }: { approvals: any[]; decide: (id: string, decision: ApprovalDecision, comments?: string) => Promise<void> }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  async function handleDecision(approvalId: string, decision: ApprovalDecision, comments?: string) {
    setBusyId(approvalId);
    setApprovalError(null);
    try {
      await decide(approvalId, decision, comments);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : "Approval update failed");
    } finally {
      setBusyId(null);
    }
  }
  return <section><div className="section-heading"><h2>Approval Inbox</h2><span>{approvals.length} assigned</span></div>{approvalError && <div className="alert">{approvalError}</div>}<div className="approval-grid">{approvals.map((approval) => <ApprovalCard key={approval.id} approval={approval} busy={busyId === approval.id} decide={handleDecision} />)}</div></section>;
}

function ApprovalCard({ approval, busy, decide }: { approval: any; busy: boolean; decide: (id: string, decision: ApprovalDecision, comments?: string) => Promise<void> }) {
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackComment, setSendBackComment] = useState("Please add more description and supporting details for this request.");
  const employee = approval.request.employee;
  const context = approval.request.context ?? [];
  const contextItems = context.filter((item: any) => ["workload", "policy_route", "proof"].includes(item.key));
  const employeeEmail = employee?.email ?? context.find((item: any) => item.key === "employee_email")?.value ?? "No email on profile";
  const leaveBalance = (employee?.leaveBalances ?? []).map((item: any) => `${item.availableDays} ${item.leaveType} days`).join("; ") || "No balance record";
  const sendBackDisabled = busy || !sendBackComment.trim();
  return (
    <article className="approval">
      <div className="approval-top">
        <div><Status status={approval.status} /><h3>{approval.request.title}</h3><p>{employee?.name} · {approval.request.requestType} · {approval.request.priority}</p></div>
        <span>{approval.stage}</span>
      </div>
      <div className="employee-summary">
        <div><span>Role</span><strong>{employee?.role?.name ?? employee?.designation ?? "Employee"}</strong></div>
        <div><span>Department</span><strong>{employee?.department?.name ?? "Corporate"}</strong></div>
        <div><span>Team</span><strong>{employee?.team?.name ?? "None"}</strong></div>
        <div><span>Manager</span><strong>{employee?.manager?.name ?? "None"}</strong></div>
        <div className="wide"><span>Email</span><strong>{employeeEmail}</strong></div>
      </div>
      <div className="approval-context">
        {contextItems.map((item: any) => <div key={`${approval.id}-${item.key}`}><span>{pretty(item.key)}</span><p>{item.value}</p></div>)}
        <div><span>Leave Balance</span><p>{leaveBalance}</p></div>
      </div>
      <AttachmentList attachments={approval.request.attachments ?? []} />
      {approval.comments && <p className="muted">{approval.comments}</p>}
      {sendBackOpen && (
        <div className="send-back-panel">
          <label htmlFor={`send-back-${approval.id}`}>Message to requester</label>
          <textarea id={`send-back-${approval.id}`} value={sendBackComment} onChange={(event) => setSendBackComment(event.target.value)} />
          <p>The requester will see this message in their request timeline and can update the request details.</p>
        </div>
      )}
      <div className="button-row">
        <button disabled={busy} onClick={() => void decide(approval.id, "approve")}>{busy ? "Saving..." : "Approve"}</button>
        <button disabled={busy} className="secondary" onClick={() => setSendBackOpen((open) => !open)}>{sendBackOpen ? "Cancel send back" : "Send back"}</button>
        {sendBackOpen && <button disabled={sendBackDisabled} className="secondary" onClick={() => void decide(approval.id, "send-back", sendBackComment)}>Send message</button>}
        <button disabled={busy} className="danger" onClick={() => void decide(approval.id, "reject")}>Reject</button>
      </div>
    </article>
  );
}

function AttachmentList({ attachments }: { attachments: any[] }) {
  const uploaded = attachments.filter((item) => item.uploadStatus === "UPLOADED");
  return <div className="attachment-list"><div className="section-heading"><h4>Attachments</h4><span>{uploaded.length}</span></div>{uploaded.length ? uploaded.map((item) => <div key={item.id}><strong>{item.fileName}</strong><span>{item.mimeType ?? "file"} · {formatBytes(item.fileSizeBytes)}</span></div>) : <p className="muted">No attachments uploaded.</p>}</div>;
}

function Resources({ resources, recommendations }: { resources: any[]; recommendations: any[] }) {
  const averageUtilization = Math.round(averageNumber(recommendations.map((item) => item.allocation)));
  const healthy = recommendations.filter((item) => item.allocation >= 75 && item.allocation <= 85).length;
  const overloaded = recommendations.filter((item) => item.allocation > 90).length;
  const idle = recommendations.filter((item) => item.allocation < 40).length;
  const teamCapacity = teamForecast(recommendations);

  return <><div className="metric-grid"><Metric label="Average utilization" value={`${averageUtilization}%`} /><Metric label="Healthy zone" value={String(healthy)} /><Metric label="Overloaded" value={String(overloaded)} tone="warn" /><Metric label="Bench / idle" value={String(idle)} /></div><div className="utilization-layout"><section><div className="section-heading"><h2>Utilization Heatmap</h2><span>40h weekly capacity</span></div><div className="utilization-grid">{recommendations.map((item) => <UtilizationCard key={item.employee.id} item={item} />)}</div></section><section><div className="section-heading"><h2>Capacity Forecast</h2><span>by team</span></div><div className="table-list">{teamCapacity.map((team) => <div key={team.name}><strong>{team.name}</strong><span>{team.people} people · avg {team.average}% · {team.state}</span></div>)}</div></section><section><div className="section-heading"><h2>Billable Split</h2><span>allocation basis</span></div><div className="split-panel"><div><strong>{Math.min(100, averageUtilization)}%</strong><span>Billable project work</span></div><div><strong>{Math.max(0, 100 - averageUtilization)}%</strong><span>Non-billable buffer</span></div></div><div className="hint">Utilization = assigned project allocation divided by total available capacity. 80% means 32 assigned hours out of a 40 hour week.</div></section><section><div className="section-heading"><h2>Asset Resources</h2><span>{resources.length}</span></div><div className="signal-list">{resources.map((item) => <Signal key={item.id} title={`${item.name} · ${item.status}`} body={`${item.type} · ${item.reference}`} />)}</div></section></div></>;
}

function UtilizationCard({ item }: { item: any }) {
  const utilization = Math.round(item.allocation);
  const state = utilizationState(utilization);
  return <article className={`util-card ${state.tone}`}><div className="util-card-head"><div><strong>{item.employee.name}</strong><span>{item.employee.designation}</span></div><b>{utilization}%</b></div><div className="util-bar"><i style={{ width: `${Math.min(100, utilization)}%` }} /></div><div className="util-card-foot"><span>{state.label}</span><small>{Math.round((utilization / 100) * 40)}h assigned / 40h capacity</small></div></article>;
}

function utilizationState(value: number) {
  if (value > 100) return { label: "Overloaded", tone: "over" };
  if (value > 90) return { label: "High load", tone: "high" };
  if (value >= 75 && value <= 85) return { label: "Healthy", tone: "healthy" };
  if (value < 40) return { label: "Bench / idle", tone: "idle" };
  return { label: "Available", tone: "available" };
}

function teamForecast(recommendations: any[]) {
  const teams = new Map<string, { total: number; people: number }>();
  for (const item of recommendations) {
    const name = item.employee.team?.name ?? item.employee.department?.name ?? "Unassigned";
    const current = teams.get(name) ?? { total: 0, people: 0 };
    current.total += item.allocation;
    current.people += 1;
    teams.set(name, current);
  }
  return [...teams.entries()].map(([name, value]) => {
    const average = Math.round(value.total / value.people);
    const state = average > 90 ? "starved for staff" : average < 40 ? "bench capacity" : "healthy capacity";
    return { name, people: value.people, average, state };
  }).sort((left, right) => right.average - left.average);
}

function Analytics({ analytics, governance }: { analytics: any; governance: any }) {
  return <><div className="metric-grid"><Metric label="Employees" value={String(analytics?.employees ?? 0)} /><Metric label="Open requests" value={String(analytics?.openRequests ?? 0)} /><Metric label="Escalated" value={String(analytics?.escalated ?? 0)} tone="warn" /><Metric label="Unread notices" value={String(analytics?.unreadNotifications ?? 0)} /></div><div className="grid"><section><div className="section-heading"><h2>Bottleneck Detection</h2><span>average hours</span></div><div className="bar-list">{(analytics?.bottlenecks ?? []).map((item: any) => <div key={item.stage}><span>{item.stage}</span><div><i style={{ width: `${Math.min(100, item.averageHours * 5)}%` }} /></div><b>{item.averageHours}h</b></div>)}</div></section><section><div className="section-heading"><h2>Notifications</h2><span>{governance?.notifications?.length ?? 0}</span></div><div className="signal-list">{(governance?.notifications ?? []).map((item: any) => <Signal key={item.id} title={`${item.requestId ?? "General"} · ${item.status}`} body={`${item.message} · ${item.recipient?.name}`} />)}</div></section></div></>;
}

function Governance({ governance }: { governance: any }) {
  return <div className="grid"><section><div className="section-heading"><h2>RBAC Matrix</h2><span>{governance?.roles?.length ?? 0} roles</span></div><div className="table-list">{(governance?.roles ?? []).map((role: any) => <div key={role.id}><strong>{role.name}</strong><span>{role.rolePermissions.map((item: any) => item.permission.id).join(", ")}</span></div>)}</div></section><section><div className="section-heading"><h2>Audit Trail</h2><span>append-only</span></div><div className="signal-list">{(governance?.auditLogs ?? []).map((item: any) => <Signal key={item.id} title={`${item.eventType} · ${item.requestId ?? "system"}`} body={`${formatDate(item.eventAt)} · ${item.actor?.name ?? "System"} · ${item.details}`} />)}</div></section></div>;
}

function Assistant({ api }: { api: (path: string, options?: RequestInit) => Promise<any> }) {
  const [prompt, setPrompt] = useState("I need leave from Monday to Wednesday for a family function.");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const output = result?.validation?.normalizedOutput ?? result?.output;
  const fields = output?.fields && typeof output.fields === "object" ? Object.keys(output.fields) : [];
  async function classify() {
    setLoading(true);
    setIntakeError(null);
    try {
      setResult(await api("/ai/intake", { method: "POST", body: JSON.stringify({ prompt }) }));
    } catch (error) {
      setIntakeError(error instanceof Error ? error.message : "Classification failed");
    } finally {
      setLoading(false);
    }
  }
  return <div className="grid"><section><div className="section-heading"><h2>AI Intake</h2><span>advisory only</span></div><div className="form-stack"><label>Employee message<input value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label><button type="button" disabled={loading} onClick={() => void classify()}>{loading ? "Classifying..." : "Classify request"}</button>{intakeError && <div className="alert">{intakeError}</div>}<div className="hint">AI classification is persisted behind the API boundary; business rules remain authoritative.</div></div></section><section><div className="section-heading"><h2>Structured Draft</h2><span>{output?.type ?? "Waiting"}</span></div><div className="context-grid"><div><span>Classification</span><strong>{output?.type ?? "None"}</strong><p>Confidence: {result ? `${Math.round((result.confidence ?? 0) * 100)}%` : "n/a"}</p></div><div><span>Recommended route</span><strong>{output?.route ?? "n/a"}</strong><p>Resolved from rules.</p></div><div><span>Fields</span><strong>{result?.validation?.status ?? "Dynamic schema"}</strong><p>{fields.join(", ") || "n/a"}</p></div></div>{result?.validation?.errors?.length > 0 && <div className="hint">Needs review: {result.validation.errors.join("; ")}</div>}</section></div>;
}

function Org({ orgTree, me }: { orgTree: any; me: any }) {
  return <div className="org-layout"><section className="org-chart-section"><div className="section-heading"><h2>Hierarchy Flow</h2><span>{orgTree?.departments?.length ?? 0} departments</span></div><div className="org-chart"><div className="org-root"><span>Organization</span><strong>{orgTree?.organization?.name ?? "OrgFlow"}</strong><small>{orgTree?.organization?.timezone ?? "Asia/Kolkata"}</small></div><div className="org-level executive-level">{(orgTree?.executives ?? []).map((employee: any) => <PersonNode key={employee.id} employee={employee} tone="executive" />)}</div><div className="department-flow">{(orgTree?.departments ?? []).map((department: any) => <article className="department-node" key={department.id}><div className="department-head"><span>{department.groupName}</span><strong>{department.name}</strong><small>{department.executiveRole}</small></div><div className="leader-row">{department.leaders?.map((leader: any) => <PersonNode key={leader.id} employee={leader} tone="leader" />)}</div><div className="team-flow">{department.teams?.map((team: any) => <div className="team-node" key={team.id}><strong>{team.name}</strong><span>{team.employees.length} people</span><div className="employee-stack">{team.employees.map((employee: any) => <PersonNode key={employee.id} employee={employee} compact />)}</div></div>)}</div></article>)}</div></div></section><section className="reporting-card"><div className="section-heading"><h2>Reporting Graph</h2><span>{me?.id}</span></div><div className="detail"><h3>{me?.name}</h3><p>{me?.designation}</p><dl><div><dt>Manager</dt><dd>{me?.manager?.name ?? "None"}</dd></div><div><dt>Department</dt><dd>{me?.department?.name ?? "Corporate"}</dd></div><div><dt>Team</dt><dd>{me?.team?.name ?? "None"}</dd></div><div><dt>Role</dt><dd>{me?.role?.name ?? "None"}</dd></div></dl></div></section></div>;
}

function PersonNode({ employee, tone, compact }: { employee: any; tone?: "executive" | "leader"; compact?: boolean }) {
  const className = ["person-node", tone, compact ? "compact" : ""].filter(Boolean).join(" ");
  return <div className={className}><strong>{employee.name}</strong><span>{employee.designation}</span>{!compact && <small>{employee.role?.name ?? employee.id}</small>}</div>;
}

function RequestRow({ request, active, onClick }: { request: RequestRecord; active?: boolean; onClick: () => void }) {
  return <button className={active ? "row-button active" : "row-button"} onClick={onClick}><span><strong>{request.title}</strong><small>{request.id} · {request.requestType} · {request.employee?.name ?? "Unknown"}</small></span><Status status={request.status} /></button>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return <div className={tone === "warn" ? "metric warn" : "metric"}><span>{label}</span><strong>{value}</strong></div>;
}

function Signal({ title, body }: { title: string; body: string }) {
  return <article className="signal"><strong>{title}</strong><p>{body}</p></article>;
}

function Status({ status }: { status: string }) {
  return <span className={`status ${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

function Meter({ label, value }: { label: string; value: number }) {
  return <div className="meter"><span>{label}</span><div><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div><b>{value}%</b></div>;
}

function makeApi(session: Session | null, onUnauthorized?: (message: string) => void) {
  return async function api(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (session) headers.set("Authorization", `Bearer ${session.accessToken}`);
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (response.status === 401 && session) {
        onUnauthorized?.("Your login expired. Please sign in again.");
      }
      throw new Error(body?.error?.message ?? `API request failed: ${response.status}`);
    }
    return response.status === 204 ? {} : response.json();
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function defaultTitle(type: string) {
  return ({
    Leave: "Leave request",
    Expense: "Expense reimbursement request",
    "Asset Request": "Asset request",
    "Resource Request": "Project resource request",
    "Work From Home": "Work from home request"
  } as Record<string, string>)[type] ?? `${type} request`;
}

function requestPriority(type: string, fields: Record<string, string>) {
  if (type === "Expense" && Number(fields.amount ?? 0) > 10000) return "High";
  if (type === "Asset Request" && Number(fields.amount ?? 0) > 50000) return "High";
  return "Medium";
}

function attachmentRequired(type: string, fields: Record<string, string>, schema: any) {
  if (schema?.proof === "Required") return true;
  if (type === "Expense") return true;
  if (type === "Asset Request" && Number(fields.amount ?? 0) >= 50000) return true;
  if (type === "Leave" && fields.leaveType === "Sick") return true;
  return false;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read attachment"));
    reader.readAsDataURL(file);
  });
}

function normalizeRequestFields(fields: Record<string, string>) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if (["amount", "allocationPct"].includes(key)) return [key, Number(value)];
    return [key, value];
  }));
}

function formatBytes(value: unknown) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "size unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function averageNumber(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function stageClass(stage: string, status?: string) {
  if (status === "Escalated") return stage === "Pending Approval" ? "stage blocked" : "stage done";
  if (status === "Processing") return stage === "Processing" ? "stage current" : ["Submitted", "Validated", "Pending Approval"].includes(stage) ? "stage done" : "stage";
  if (status === "Approved") return "stage done";
  if (status === "Rejected") return stage === "Submitted" ? "stage done" : "stage blocked";
  return stage === "Pending Approval" ? "stage current" : ["Submitted", "Validated"].includes(stage) ? "stage done" : "stage";
}

function stageHint(stage: string, request?: RequestRecord) {
  if (!request) return "Waiting for persisted request";
  if (stage === "Submitted") return formatDate(request.createdAt);
  if (stage === "Validated") return (request.attachments ?? []).some((item) => item.isRequired) ? "Proof required" : "No proof required";
  if (stage === "Pending Approval") return `Owner: ${request.currentOwner?.name ?? "None"}`;
  if (stage === "Processing") return request.status === "Processing" ? "Downstream owner active" : "Waiting";
  return request.status === "Approved" ? "Complete" : "Not reached";
}

function label(view: View) {
  return ({ dashboard: "Dashboard", requests: "Requests", tracking: "Tracking", approvals: "Approvals", resources: "Resources", analytics: "Analytics", governance: "Governance", ai: "AI Intake", org: "Organization" })[view];
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
