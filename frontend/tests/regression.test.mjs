import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { api, setToken } from "../src/services/http.ts";
import { authService } from "../src/services/auth.ts";
import { alertsService } from "../src/services/alerts.ts";
import { casesService } from "../src/services/cases.ts";
import { financeService } from "../src/services/finance.ts";
import { reportsService } from "../src/services/reports.ts";
import { dashboardService } from "../src/services/dashboard.ts";
import { legalAreasService } from "../src/services/legalAreas.ts";
import App from "../src/app/App.tsx";
import AppShell from "../src/components/layout/AppShell.tsx";
import CaseWorkspace from "../src/features/cases/CaseWorkspace.tsx";
import CaseAccess, {
  availableAssistants,
} from "../src/features/cases/components/CaseAccess.tsx";
import CasesPage from "../src/features/cases/CasesPage.tsx";
import CaseForm from "../src/features/cases/forms/CaseForm.tsx";
import ClientsPage from "../src/features/clients/ClientsPage.tsx";
import ClientForm from "../src/features/clients/forms/ClientForm.tsx";
import DashboardPage from "../src/features/dashboard/DashboardPage.tsx";
import EntryForm from "../src/features/cases/forms/EntryForm.tsx";
import PaymentForm from "../src/features/cases/forms/PaymentForm.tsx";
import CollectionForm from "../src/features/cases/forms/CollectionForm.tsx";
import EntryTable from "../src/features/cases/components/EntryTable.tsx";
import AreaSelect from "../src/features/cases/components/AreaSelect.tsx";
import AlertCalendar from "../src/features/dashboard/components/AlertCalendar.tsx";
import AlertTable from "../src/features/dashboard/components/AlertTable.tsx";
import Reports from "../src/features/reports/Reports.tsx";
import AdministrationPage from "../src/features/admin/AdministrationPage.tsx";
import UserForm from "../src/features/admin/forms/UserForm.tsx";
import LegalAreaForm from "../src/features/admin/forms/LegalAreaForm.tsx";
import { dateTimeLabels, dateLabel } from "../src/utils/format.ts";
import { automaticAllocations } from "../src/features/cases/models/paymentAllocation.ts";
import { useLexio } from "../src/hooks/useLexio.ts";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  setToken("");
});
const noop = () => {};
const admin = {
  id: 1,
  name: "David",
  username: "admin",
  role: "admin",
  active: true,
};
const staff = {
  ...admin,
  id: 2,
  name: "Abogado",
  role: "staff",
  can_create_cases: true,
};
const client = {
  id: 1,
  code: "CL-000001",
  name: "Ana Torres",
  document_type: "DNI",
  document_number: "12345678",
  phone: "999555222",
  email: "",
  address: "Lima",
  lead_source: "Referido",
};
const areas = [
  { id: 1, name: "Civil" },
  { id: 2, name: "Penal" },
];
const item = {
  id: 1,
  code: "CAS-000001",
  client_id: 1,
  client,
  area_id: 1,
  area: "Civil",
  process_type: "Cobro de deuda",
  initial_stage: "Demanda",
  status: "activo",
  responsible_id: 2,
  responsible_name: "Abogado",
  created_at: "2026-10-08T15:00:00",
  access_level: "edit",
  fee: "1000.00",
  paid: "400.00",
  balance: "600.00",
  cancelled: false,
  installments: [
    {
      id: 1,
      number: 1,
      amount: "500.00",
      paid: "400.00",
      balance: "100.00",
      due_date: "2026-10-09",
      state: "pendiente",
    },
    {
      id: 2,
      number: 2,
      amount: "500.00",
      paid: "0.00",
      balance: "500.00",
      due_date: "2026-10-12",
      state: "pendiente",
    },
  ],
  payments: [
    {
      id: 1,
      payment_date: "2026-10-08",
      amount: "400.00",
      method: "Efectivo",
      registered_by: 1,
      created_at: "2026-10-08T15:00:00",
    },
  ],
};
test("equipo autorizado distingue al responsable y ofrece solo asistentes sin acceso", () => {
  const props = {
    item,
    users: [admin, staff],
    changed: async () => {},
  };
  const html = render(CaseAccess, props);
  assert.match(html, /Responsable del caso/);
  assert.match(html, /Acceso permanente/);
  assert.match(html, /Agregar asistente/);
  assert.doesNotMatch(html, /Cambiar responsable|name="responsible_id"/);
  const colleague = { ...staff, id: 3, name: "Otro asistente" };
  const inactive = { ...staff, id: 4, active: false };
  const users = [admin, staff, colleague, inactive];
  const access = [
    { id: 1, user_id: staff.id, user_name: staff.name, level: "edit" },
  ];
  assert.deepEqual(availableAssistants(users, access), [colleague]);
  assert.deepEqual(availableAssistants(users, []), [staff, colleague]);
  assert.deepEqual(
    availableAssistants(users, [...access, { user_id: colleague.id }]),
    [],
  );
});

function render(component, props = {}) {
  return renderToStaticMarkup(createElement(component, props));
}
function capture(response = {}) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return Response.json(response);
  };
  return calls;
}
function textOf(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return node && typeof node === "object" ? textOf(node.props?.children) : "";
}
function findButtons(node, label) {
  if (Array.isArray(node))
    return node.flatMap((child) => findButtons(child, label));
  if (!node || typeof node !== "object") return [];
  if (node.type === "button" && textOf(node) === label) return [node];
  return findButtons(node.props?.children, label);
}
function formProps(component, props) {
  let form;
  function CaptureForm() {
    form = component(props);
    return null;
  }
  render(CaptureForm);
  return form.props;
}
function componentTree(component, props) {
  let tree;
  function CaptureTree() {
    tree = component(props);
    return null;
  }
  render(CaptureTree);
  return tree;
}

test("login y JWT mantienen credenciales por usuario y token en memoria", async () => {
  const calls = capture({ access_token: "token", user: admin });
  await authService.login({ username: "admin", password: "fixture" });
  assert.equal(calls[0].url, "https://lexio.test/auth/login");
  assert.deepEqual(JSON.parse(calls[0].body), {
    username: "admin",
    password: "fixture",
  });
  setToken("token");
  await api("/cases");
  assert.equal(calls[1].headers.Authorization, "Bearer token");
  assert.ok(calls[1].signal instanceof AbortSignal);
});
test("401 elimina el token y comunica expiración", async () => {
  const events = [];
  globalThis.window = { dispatchEvent: (e) => events.push(e.type) };
  setToken("expired");
  globalThis.fetch = async () =>
    Response.json({ detail: "Sesión vencida" }, { status: 401 });
  await assert.rejects(api("/cases"), /Sesión vencida/);
  assert.deepEqual(events, ["lexio-session-expired"]);
  const calls = capture();
  await api("/cases");
  assert.equal(calls[0].headers.Authorization, undefined);
});
test("una respuesta 401 de la sesión anterior conserva la sesión nueva", async () => {
  const events = [];
  let finish;
  globalThis.window = { dispatchEvent: (e) => events.push(e.type) };
  globalThis.fetch = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  setToken("old-session");
  const pending = assert.rejects(api("/cases"), /Sesión anterior vencida/);
  setToken("new-session");
  finish(Response.json({ detail: "Sesión anterior vencida" }, { status: 401 }));
  await pending;
  assert.deepEqual(events, []);
  const calls = capture();
  await api("/cases");
  assert.equal(calls[0].headers.Authorization, "Bearer new-session");
});
test("la aplicación inicia en login y conserva el punto de montaje", async () => {
  const html = render(App);
  assert.match(html, /Ingresa a tu estudio/);
  assert.match(html, /name="username"/);
  assert.doesNotMatch(html, /type="email"/);
  const entry = await readFile(
    new URL("../src/main.tsx", import.meta.url),
    "utf8",
  );
  const document = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  assert.ok(
    document.includes(`id="${entry.match(/getElementById\("([^"]+)"\)/)[1]}"`),
  );
});
test("al iniciar una sesión la página inicial es el panel", () => {
  let initialPage;
  function InitialPage() {
    initialPage = useLexio().page;
    return null;
  }
  render(InitialPage);
  assert.equal(initialPage, "inicio");
});
test("Inicio reúne alertas y cobros con acceso a la pestaña financiera y respeta el rol", async () => {
  const dashboard = {
    counts: {
      total_cases: 4,
      active_cases: 3,
      concluded_cases: 1,
      pending_legal_alerts: 2,
    },
    finance: { fee: "12000.00", paid: "2000.00", balance: "10000.00" },
    upcoming_payments: [
      {
        id: 1,
        case_id: 7,
        case_code: "CAS-000007",
        client_code: client.code,
        client_name: client.name,
        process_type: item.process_type,
        number: 1,
        due_date: "2026-10-15",
        balance: "9876.54",
      },
    ],
  };
  const opened = [];
  const props = {
    actor: admin,
    dashboard,
    alerts: [],
    isAdmin: true,
    busy: false,
    load: noop,
    openCase: (id, tab) => opened.push([id, tab]),
  };
  const html = render(DashboardPage, props);
  for (const label of [
    "Panel del día",
    "Alertas procesales y otros",
    "Alerta de cobros",
    "Cliente y caso",
    "Saldo de la cuota",
    "CAS-000007",
  ])
    assert.ok(html.includes(label));
  assert.doesNotMatch(html, /class="eyebrow">[1-4]\s*·/);
  const tree = DashboardPage(props);
  findButtons(tree, "Ver caso")[0].props.onClick();
  assert.equal(findButtons(tree, "Ver todas las alertas").length, 0);
  assert.deepEqual(opened, [[7, "finanzas"]]);
  const team = render(DashboardPage, {
    ...props,
    actor: staff,
    isAdmin: false,
  });
  assert.match(team, /Alertas procesales y otros/);
  assert.doesNotMatch(team, /Alerta de cobros|Saldo de la cuota|9[,.]876/);
  const calls = capture(dashboard);
  assert.deepEqual(await dashboardService.get(), dashboard);
  assert.equal(calls[0].url, "https://lexio.test/dashboard");
});
test("navegación separa Inicio, Clientes y Casos sin bitácora independiente", () => {
  const props = {
    actor: admin,
    page: "inicio",
    onNavigate: noop,
    onLogout: noop,
    children: "",
  };
  const html = render(AppShell, props);
  for (const label of [
    "Inicio",
    "Clientes",
    "Casos",
    "Reportes",
    "Configuración",
  ])
    assert.ok(html.includes(`title="${label}"`));
  assert.doesNotMatch(
    html,
    /title="Administración"|title="Alertas y vencimientos"|title="Ficha integral"|title="Bitácora del caso"|1 ·|2 ·|3 ·|4 ·/,
  );
  const staffHtml = render(AppShell, { ...props, actor: staff });
  assert.match(staffHtml, /title="Configuración"/);
  assert.doesNotMatch(staffHtml, /title="Administración"/);
});
test("filtros envían nombres del contrato y omiten valores vacíos", async () => {
  const calls = capture([]);
  await casesService.list({
    search: "Ana & José",
    area_id: "",
    status: "activo",
  });
  await casesService.list();
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get("search"), "Ana & José");
  assert.equal(url.searchParams.has("area_id"), false);
  assert.equal(calls[1].url, "https://lexio.test/cases");
  await casesService.list({ client_id: String(client.id) });
  assert.deepEqual(
    [...new URL(calls[2].url).searchParams],
    [["client_id", "1"]],
  );
  await casesService.list({ area_id: "42" });
  assert.deepEqual(
    [...new URL(calls[3].url).searchParams],
    [["area_id", "42"]],
  );
});
test("clientes ofrecen acciones separadas vinculadas al mismo cliente", () => {
  const selected = [];
  const props = {
    actor: admin,
    clients: [client],
    busy: false,
    search: "",
    setSearch: noop,
    load: noop,
    create: noop,
    edit: (value) => selected.push(["edit", value]),
    viewCases: (value) => selected.push(["view", value]),
    newCase: (value) => selected.push(["new", value]),
  };
  const html = render(ClientsPage, props);
  assert.doesNotMatch(
    html,
    /Honorarios|Control financiero|Bitácora|link-button/,
  );
  const tree = ClientsPage(props);
  for (const label of ["Ver casos", "Nuevo caso", "Corregir datos"])
    assert.match(
      findButtons(tree, label)[0].props.className,
      /^(primary|secondary)\b/,
    );
  findButtons(tree, "Ver casos")[0].props.onClick();
  findButtons(tree, "Nuevo caso")[0].props.onClick();
  findButtons(tree, "Corregir datos")[0].props.onClick();
  assert.deepEqual(selected, [
    ["view", client],
    ["new", client],
    ["edit", client],
  ]);
  const team = render(ClientsPage, { ...props, actor: staff });
  assert.match(team, />Ver casos</);
  assert.match(team, />Nuevo caso</);
  assert.doesNotMatch(team, /Corregir datos|>Nuevo cliente</);
  assert.doesNotMatch(
    render(ClientsPage, {
      ...props,
      actor: { ...staff, can_create_cases: false },
    }),
    />Nuevo caso</,
  );
});
test("datos personales se crean y corrigen exclusivamente en el formulario de clientes", async () => {
  const html = render(ClientForm, { saved: noop });
  for (const name of [
    "name",
    "document_type",
    "document_number",
    "phone",
    "email",
    "address",
    "lead_source",
  ])
    assert.ok(html.includes(`name="${name}"`));
  for (const source of [
    "Sin atribución",
    "Instagram",
    "Facebook",
    "Tiktok",
    "Web",
    "Referido",
    "Volantes",
    "Otro",
  ])
    assert.ok(html.includes(`>${source}</option>`));
  assert.match(html, /<option value="Sin atribución" selected="">Sin atribución<\/option>/);
  assert.doesNotMatch(
    html,
    /name="code"|name="process_type"|name="initial_stage"|Honorarios|Agregar cuota/,
  );
  const calls = capture(client);
  const form = new FormData();
  for (const [name, value] of Object.entries({
    name: client.name,
    document_type: client.document_type,
    document_number: client.document_number,
    phone: client.phone,
    email: client.email,
    address: client.address,
    lead_source: client.lead_source,
  }))
    form.set(name, value);
  form.set("code", "NO-EDITABLE");
  form.set("tenant_id", "99");
  await ClientForm({ saved: noop }).props.submit(form);
  await ClientForm({ item: client, saved: noop }).props.submit(form);
  assert.deepEqual(
    calls.map((call) => [new URL(call.url).pathname, call.method]),
    [
      ["/clients", "POST"],
      ["/clients/1", "PUT"],
    ],
  );
  assert.deepEqual(JSON.parse(calls[0].body), {
    name: client.name,
    document_type: client.document_type,
    document_number: client.document_number,
    phone: client.phone,
    email: client.email,
    address: client.address,
    lead_source: client.lead_source,
  });
  assert.equal("code" in JSON.parse(calls[1].body), false);
  assert.equal("tenant_id" in JSON.parse(calls[1].body), false);
  assert.match(render(ClientForm, { item: client, saved: noop }), /CL-000001/);
});
test("lista de casos ofrece botones claros y separa activos de archivados sin columna Estado", () => {
  let created = false;
  const concludedCase = {
    ...item,
    id: 2,
    process_type: "Proceso concluido",
    status: "concluido",
  };
  const withdrawnCase = {
    ...item,
    id: 3,
    process_type: "Proceso retirado",
    status: "retirado",
  };
  const props = {
    actor: admin,
    isAdmin: true,
    cases: [item, concludedCase, withdrawnCase],
    areas,
    clients: [client],
    busy: false,
    search: "",
    area: "",
    status: "",
    clientFilter: "",
    setSearch: noop,
    setArea: noop,
    setStatus: noop,
    setClientFilter: noop,
    load: noop,
    clearFilters: noop,
    openCase: noop,
    create: () => {
      created = true;
    },
  };
  const html = render(CasesPage, props);
  assert.match(html, />Casos archivados</);
  assert.match(html, />Nuevo caso</);
  assert.ok(html.indexOf("Casos archivados") < html.indexOf("Nuevo caso"));
  assert.match(html, /Cobro de deuda/);
  assert.doesNotMatch(html, /Proceso concluido|Proceso retirado|<th>Estado<\/th>/);

  const archivedHtml = render(CasesPage, { ...props, initialArchived: true });
  assert.match(archivedHtml, /Proceso concluido/);
  assert.match(archivedHtml, /Proceso retirado/);
  assert.doesNotMatch(archivedHtml, /Cobro de deuda|<th>Estado<\/th>/);
  assert.match(html, />Ver caso</);
  assert.match(html, />Limpiar filtros</);
  assert.doesNotMatch(html, /suspendido|link-button/);
  findButtons(CasesPage(props), "Nuevo caso")[0].props.onClick();
  assert.equal(created, true);
});
test("dos casos del mismo cliente conservan botones de acceso independientes", () => {
  const opened = [];
  const props = {
    actor: admin,
    isAdmin: true,
    cases: [item, { ...item, id: 2, process_type: "Desalojo" }],
    areas,
    clients: [client],
    busy: false,
    search: "",
    area: "",
    status: "",
    clientFilter: "",
    setSearch: noop,
    setArea: noop,
    setStatus: noop,
    setClientFilter: noop,
    load: noop,
    clearFilters: noop,
    openCase: (id) => opened.push(id),
    create: noop,
  };
  const html = render(CasesPage, props);
  assert.match(html, /Cobro de deuda/);
  assert.match(html, /Desalojo/);
  const buttons = findButtons(CasesPage(props), "Ver caso");
  assert.equal(buttons.length, 2);
  buttons.forEach((button) => button.props.onClick());
  assert.deepEqual(opened, [1, 2]);
});
test("crear caso selecciona un cliente existente y reúne proceso y honorarios", () => {
  const html = render(CaseForm, {
    actor: admin,
    areas,
    users: [admin, staff],
    clients: [client],
    saved: noop,
  });
  for (const text of [
    "Tipo de proceso",
    "Control financiero",
    "Honorarios totales",
    "Agregar cuota",
  ])
    assert.ok(html.includes(text));
  assert.match(html, /name="client_id"/);
  assert.match(html, /12345678 · Ana Torres/);
  assert.match(html, /name="initial_stage"/);
  assert.doesNotMatch(
    html,
    /name="name"|name="document_number"|name="phone"|name="email"|name="address"|current_stage|subject|Contratar servicio/,
  );
});
test("nuevo caso desde un cliente conserva la selección y orienta si falta registrarlo", () => {
  const second = { ...client, id: 2, code: "CL-000002", name: "Luis Pérez" };
  const props = {
    actor: admin,
    users: [admin],
    clients: [client, second],
    areas,
    clientId: 2,
    saved: noop,
  };
  assert.match(
    render(CaseForm, props),
    /<option value="2" selected="">12345678 · Luis Pérez<\/option>/,
  );
  assert.match(
    render(CaseForm, { ...props, clients: [], clientId: undefined }),
    /Primero registra al cliente en la página Clientes/,
  );
});
test("editar proceso como staff conserva datos de cliente y oculta finanzas", () => {
  const html = render(CaseForm, {
    actor: staff,
    areas,
    users: [staff],
    clients: [client],
    item,
    saved: noop,
  });
  assert.match(html, /Ana Torres/);
  assert.match(html, /name="process_type"/);
  assert.doesNotMatch(
    html,
    /name="name"|name="document_number"|Honorarios|Control financiero/,
  );
});
test("caso con abonos bloquea solo la cuota pagada y permite editar la otra", () => {
  const html = render(CaseForm, {
    actor: admin,
    users: [admin, staff],
    clients: [client],
    areas,
    item,
    saved: noop,
  });
  assert.match(html, /Solo las cuotas que recibieron abonos están bloqueadas/);
  assert.equal((html.match(/readOnly=""/g) || []).length, 2);
  assert.match(html.match(/<input[^>]*name="fee"[^>]*>/)[0], /min="0.01"/);
  assert.match(html.match(/<input[^>]*name="amount_0"[^>]*>/)[0], /readOnly/);
  assert.doesNotMatch(
    html.match(/<input[^>]*name="amount_1"[^>]*>/)[0],
    /readOnly/,
  );
  assert.match(html, /name="due_date_0"/);
  assert.match(html, /name="due_date_1"/);
  assert.match(html, /Agregar cuota/);
  assert.equal((html.match(/Quitar cuota/g) || []).length, 1);
  assert.doesNotMatch(
    html,
    /name="name"|name="document_number"|name="phone"|name="email"|name="address"/,
  );
});
test("un evento vinculado sin abonos permite editar importe y modalidad", () => {
  const html = render(CaseForm, {
    actor: admin,
    clients: [client],
    areas,
    item: {
      ...item,
      installments: [
        item.installments[0],
        {
          ...item.installments[1],
          number: 4,
          event_name: "Sentencia",
          entry_id: 9,
          activated_at: "2026-10-08T12:00:00Z",
        },
      ],
    },
    saved: noop,
  });
  assert.doesNotMatch(
    html.match(/<input[^>]*name="amount_1"[^>]*>/)[0],
    /readOnly/,
  );
  assert.doesNotMatch(
    html.match(/<input[^>]*name="event_name_1"[^>]*>/)[0],
    /readOnly/,
  );
  assert.equal((html.match(/<select[^>]*disabled/g) || []).length, 1);
  assert.match(html, /Cuota 4 · importe/);
});
test("editar un caso a Retirado conserva el cliente y las cuotas sin reenviar datos personales", async () => {
  const calls = capture(item);
  const form = new FormData();
  for (const [name, value] of Object.entries({
    area_id: String(item.area_id),
    process_type: item.process_type,
    initial_stage: item.initial_stage,
    status: "retirado",
    responsible_id: String(staff.id),
    fee: item.fee,
    amount_0: "500.00",
    due_date_0: "2026-10-16",
    amount_1: "500.00",
    due_date_1: "2026-10-20",
  }))
    form.set(name, value);
  form.set("name", "No debe modificar al cliente");
  await formProps(CaseForm, {
    actor: admin,
    areas,
    users: [admin, staff],
    clients: [client],
    item,
    saved: noop,
  }).submit(form);
  assert.equal(calls[0].url, "https://lexio.test/cases/1");
  assert.equal(calls[0].method, "PUT");
  const data = JSON.parse(calls[0].body);
  assert.equal(data.status, "retirado");
  assert.equal(data.responsible_id, staff.id);
  assert.equal(data.area_id, item.area_id);
  assert.equal("area" in data, false);
  assert.deepEqual(data.installments, [
    { id: 1, amount: "500.00", due_date: "2026-10-16" },
    { id: 2, amount: "500.00", due_date: "2026-10-20" },
  ]);
  assert.equal(data.fee, item.fee);
  for (const name of ["client", "client_id", "name", "tenant_id"])
    assert.equal(name in data, false);
});
test("detalle destaca primero el cliente y oculta importes al equipo", () => {
  const props = {
    selected: item,
    areas,
    actor: admin,
    users: [admin, staff],
    clients: [client],
    back: noop,
  };
  const html = render(CaseWorkspace, props);
  const withdrawn = render(CaseWorkspace, {
    ...props,
    selected: { ...item, status: "retirado" },
  });
  assert.match(withdrawn, />Retirado</);
  assert.doesNotMatch(withdrawn, /Concluir caso/);
  assert.match(
    render(CaseForm, {
      ...props,
      item: { ...item, status: "retirado" },
      saved: noop,
    }),
    /value="retirado" selected="">Retirado/,
  );
  assert.ok(
    html.indexOf('class="client-title">Ana Torres') <
      html.indexOf("<h2>Cobro de deuda"),
  );
  assert.match(html, /Bitácora del caso/);
  assert.match(html, /role="tab"[^>]*aria-selected="true"[^>]*>Bitácora/);
  assert.match(html, /id="case-finanzas-panel"[^>]*hidden=""/);
  const financial = render(CaseWorkspace, { ...props, initialTab: "finanzas" });
  assert.match(financial, /Registrar abono/);
  assert.match(financial, /Total abonado/);
  assert.match(financial, /Cuota 1/);
  assert.match(financial, /Datos del cliente y proceso/);
  assert.match(financial, /id="case-bitacora-panel"[^>]*hidden=""/);
  const team = render(CaseWorkspace, { ...props, actor: staff });
  assert.doesNotMatch(
    team,
    /Control financiero|Registrar abono|Eliminar abono/,
  );
  assert.doesNotMatch(
    render(CaseWorkspace, { ...props, actor: staff, initialTab: "finanzas" }),
    /Control financiero|Registrar abono|Total abonado/,
  );
  assert.doesNotMatch(
    team,
    /Contratar servicio|Aplicar crédito|Vincular evento|Archivos/,
  );
});
test("selector lee el catálogo de la API y mantiene el ID al cambiar nombres", async () => {
  const catalog = [
    { id: 19, name: "Derecho ambiental" },
    { id: 42, name: "Derecho digital" },
  ];
  const calls = capture(catalog);
  const loaded = await legalAreasService.list();
  assert.equal(calls[0].url, "https://lexio.test/legal-areas");
  assert.equal(calls[0].method, "GET");
  const props = {
    name: "area_id",
    required: true,
    defaultValue: 42,
    areas: loaded,
  };
  const html = render(AreaSelect, props);
  assert.equal((html.match(/<option /g) || []).length, 3);
  assert.match(
    html,
    /<option value="42" selected="">Derecho digital<\/option>/,
  );
  assert.match(html, /<option value="19">Derecho ambiental<\/option>/);
  assert.doesNotMatch(html, />Civil<|>Penal</);
  const renamed = render(AreaSelect, {
    ...props,
    areas: [catalog[0], { ...catalog[1], name: "Derecho tecnológico" }],
  });
  assert.match(
    renamed,
    /<option value="42" selected="">Derecho tecnológico<\/option>/,
  );
  assert.doesNotMatch(renamed, /Derecho digital/);
  assert.match(render(AreaSelect, { ...props, areas: [] }), /Sin ramas/);
});
test("un cliente puede tener varios casos con honorarios propios", async () => {
  const calls = capture(item);
  const data = {
    client_id: client.id,
    area_id: 1,
    process_type: "Cobro",
    initial_stage: "Demanda",
    status: "activo",
    responsible_id: admin.id,
    fee: "1000.00",
    installments: [{ amount: "1000.00", due_date: "2026-10-15" }],
  };
  const form = new FormData();
  for (const [name, value] of Object.entries({
    client_id: String(client.id),
    area_id: String(data.area_id),
    process_type: data.process_type,
    initial_stage: data.initial_stage,
    status: data.status,
    responsible_id: String(admin.id),
    fee: data.fee,
    amount_0: "1000.00",
    due_date_0: "2026-10-15",
  }))
    form.set(name, value);
  form.set("name", "Estos datos se editan en Clientes");
  const props = {
    actor: admin,
    users: [admin],
    clients: [client],
    areas,
    saved: noop,
  };
  await formProps(CaseForm, props).submit(form);
  assert.equal(calls[0].url, "https://lexio.test/cases");
  assert.deepEqual(JSON.parse(calls[0].body), data);
  assert.equal(JSON.parse(calls[0].body).responsible_id, admin.id);
  assert.equal("tenant_id" in data, false);
  assert.equal("client" in JSON.parse(calls[0].body), false);
  form.set("process_type", "Desalojo");
  form.set("fee", "2000.00");
  form.set("amount_0", "2000.00");
  form.set("due_date_0", "2026-10-20");
  await formProps(CaseForm, props).submit(form);
  const second = JSON.parse(calls[1].body);
  assert.equal(second.client_id, data.client_id);
  assert.equal(second.process_type, "Desalojo");
  assert.equal(second.fee, "2000.00");
  assert.equal("client" in second, false);
});
test("nuevas ramas se envían por ID y un catálogo vacío o ajeno impide guardar", async () => {
  const calls = capture(item);
  const form = new FormData();
  for (const [name, value] of Object.entries({
    client_id: "1",
    area_id: "42",
    process_type: "Protección de datos",
    initial_stage: "Consulta",
    status: "activo",
  }))
    form.set(name, value);
  const props = {
    actor: staff,
    users: [staff],
    clients: [client],
    areas: [{ id: 42, name: "Derecho digital" }],
    saved: noop,
  };
  await formProps(CaseForm, props).submit(form);
  const submitted = JSON.parse(calls[0].body);
  assert.equal(submitted.area_id, 42);
  assert.equal("area" in submitted, false);
  assert.equal("tenant_id" in submitted, false);
  form.set("area_id", "99");
  await assert.rejects(
    formProps(CaseForm, props).submit(form),
    /Selecciona una rama del catálogo/,
  );
  await assert.rejects(
    formProps(CaseForm, { ...props, areas: [] }).submit(form),
    /configurar el catálogo/,
  );
  assert.equal(calls.length, 1);
});
test("cuotas por evento se editan con el hito y se muestran esperando su activación", async () => {
  const eventQuota = {
    ...item.installments[1],
    due_date: null,
    event_name: "Sentencia favorable",
    activated_at: null,
    entry_id: null,
    state: "esperando_evento",
  };
  const eventCase = {
    ...item,
    payments: [],
    installments: [item.installments[0], eventQuota],
  };
  const props = {
    actor: admin,
    clients: [client],
    areas,
    item: eventCase,
    saved: noop,
  };
  const html = render(CaseForm, props);
  assert.match(html, /Evento \/ hito/);
  assert.match(html, /name="event_name_1"/);
  assert.doesNotMatch(html, /name="due_date_1"/);
  const form = new FormData();
  for (const [key, value] of Object.entries({
    area_id: "1",
    process_type: item.process_type,
    initial_stage: item.initial_stage,
    status: "activo",
    fee: "1000.00",
    amount_0: "500.00",
    due_date_0: "2026-10-15",
    amount_1: "500.00",
    event_name_1: "Sentencia favorable",
  }))
    form.set(key, value);
  const calls = capture(eventCase);
  await formProps(CaseForm, props).submit(form);
  assert.deepEqual(JSON.parse(calls[0].body).installments[1], {
    id: eventQuota.id,
    amount: "500.00",
    due_date: null,
    event_name: "Sentencia favorable",
  });
  const workspace = render(CaseWorkspace, {
    selected: eventCase,
    actor: admin,
    users: [admin, staff],
    clients: [client],
    areas,
    initialTab: "finanzas",
    back: noop,
  });
  assert.match(workspace, /Esperando evento/);
  assert.match(workspace, /Sentencia favorable/);
});

test("solo el administrador vincula una actuación con una cuota por evento disponible", async () => {
  const available = {
    ...item.installments[1],
    due_date: null,
    event_name: "Sentencia favorable",
    activated_at: null,
    entry_id: null,
  };
  const linked = {
    ...available,
    id: 8,
    event_name: "Evento ya vinculado",
    entry_id: 99,
  };
  const activated = {
    ...available,
    id: 9,
    event_name: "Evento ya activado",
    activated_at: "2026-10-08T15:00:00",
  };
  const props = {
    caseId: 1,
    actor: admin,
    installments: [item.installments[0], available, linked, activated],
    done: async () => {},
  };
  const html = render(EntryForm, props);
  assert.match(html, /name="payment_installment_id"/);
  assert.match(html, /Sentencia favorable/);
  assert.doesNotMatch(html, /Evento ya vinculado|Evento ya activado/);
  const form = new FormData();
  for (const [key, value] of Object.entries({
    action_date: "2026-10-08",
    subject: "Sentencia",
    subject_type: "legal",
    description: "Hito alcanzado",
    payment_installment_id: String(available.id),
  }))
    form.set(key, value);
  const calls = capture({});
  await EntryForm(props).props.submit(form);
  assert.equal(JSON.parse(calls[0].body).payment_installment_id, available.id);
  await EntryForm({ ...props, actor: staff }).props.submit(form);
  assert.equal("payment_installment_id" in JSON.parse(calls[1].body), false);
  assert.doesNotMatch(
    render(EntryForm, { ...props, actor: staff }),
    /payment_installment_id|Sentencia favorable/,
  );
});

test("una actuación vinculada sin alerta procesal puede atenderse sin exponer finanzas al asistente", () => {
  const entry = {
    id: 7,
    action_date: "2026-10-08",
    subject: "Sentencia",
    subject_type: "legal",
    description: "Hito alcanzado",
    alert_date: null,
    attended: false,
    can_attend: true,
    responsible_name: admin.name,
    created_at: "2026-10-08T15:00:00",
    payment_installment_id: 2,
    payment_event: "Sentencia favorable",
    payment_activated: false,
  };
  const html = render(EntryTable, {
    entries: [entry],
    canEdit: true,
    load: noop,
  });
  assert.match(html, /Marcar atendido/);
  assert.match(html, /Esperando fecha de alerta/);
  assert.doesNotMatch(
    render(EntryTable, {
      entries: [{ ...entry, attended: true, payment_activated: true }],
      load: noop,
    }),
    /Marcar atendido/,
  );
  const {
    payment_installment_id,
    payment_event,
    payment_activated,
    ...staffEntry
  } = entry;
  const staffHtml = render(EntryTable, { entries: [staffEntry], load: noop });
  assert.match(staffHtml, /Marcar atendido/);
  assert.doesNotMatch(staffHtml, /Pago por evento|Sentencia favorable/);
});

test("bitácora envía asunto, tipo y descripción detallada con responsable autenticado", async () => {
  const calls = capture({});
  const form = new FormData();
  form.set("action_date", "2026-10-08");
  form.set("subject", "Presentar escrito");
  form.set("subject_type", "legal");
  form.set("description", "Presentar escrito");
  form.set("alert_date", "2026-10-15");
  await EntryForm({
    caseId: 1,
    actor: staff,
    done: async () => {},
  }).props.submit(form);
  assert.equal(calls[0].url, "https://lexio.test/cases/1/entries");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(JSON.parse(calls[0].body), {
    action_date: "2026-10-08",
    subject: "Presentar escrito",
    subject_type: "legal",
    description: "Presentar escrito",
    alert_date: "2026-10-15",
  });
  const html = render(EntryForm, { caseId: 1, actor: staff, done: noop });
  assert.match(html, /Responsable: Abogado/);
  assert.match(html, /se guardan automáticamente/);
  assert.match(html, /name="alert_time"/);
  assert.match(
    html,
    /<input(?=[^>]*name="subject")(?=[^>]*maxLength="150")[^>]*>/,
  );
  assert.match(html, /name="subject_type"/);
  assert.match(html, /value="otro">Otro/);
  assert.doesNotMatch(html, /is_payment_event|responsible_id/);
  form.set("alert_time", "09:30");
  await EntryForm({
    caseId: 1,
    actor: staff,
    done: async () => {},
  }).props.submit(form);
  assert.equal(JSON.parse(calls[1].body).alert_time, "09:30");
  form.set("alert_date", "");
  await assert.rejects(
    EntryForm({
      caseId: 1,
      actor: staff,
      done: async () => {},
    }).props.submit(form),
    /Indica la fecha de alerta/,
  );
});
test("editar actuación precarga sus fechas y texto y conserva el registro original", () => {
  const entry = {
    id: 7,
    case_id: 1,
    action_date: "2026-10-07",
    subject: "Escrito original",
    subject_type: "otro",
    description: "Presentar escrito original",
    alert_date: "2026-10-15",
    attended: true,
    registered_by: staff.id,
    responsible_name: staff.name,
    created_at: "2026-10-09T02:30:00",
  };
  const html = render(EntryForm, {
    caseId: 1,
    actor: admin,
    item: entry,
    done: noop,
  });
  assert.match(html, /name="action_date"[^>]*value="2026-10-07"/);
  assert.match(html, /name="alert_date"[^>]*value="2026-10-15"/);
  assert.match(html, /name="subject"[^>]*value="Escrito original"/);
  assert.match(html, /value="otro" selected="">Otro/);
  assert.match(
    html,
    /<textarea[^>]*name="description"[^>]*>Presentar escrito original<\/textarea>/,
  );
  assert.match(html, /Guardar cambios/);
  assert.match(html, /Responsable: Abogado/);
  assert.match(html, /8 de octubre de 2026/);
  assert.match(html, /9:30/);
  assert.match(html, /ya está atendido/);
  assert.doesNotMatch(
    html,
    /Responsable: David|name="registered_by"|name="created_at"|name="attended"|type="checkbox"/,
  );
});
test("corregir actuación envía asunto y tipo sin alterar autor, hora o Atendido", async () => {
  const entry = {
    id: 7,
    case_id: 1,
    action_date: "2026-10-07",
    subject: "Escrito original",
    subject_type: "legal",
    description: "Escrito original",
    alert_date: "2026-10-15",
    attended: true,
    registered_by: staff.id,
    responsible_name: staff.name,
    created_at: "2026-10-09T02:30:00",
  };
  const calls = capture(entry);
  let completed = 0;
  const form = new FormData();
  form.set("action_date", "2026-10-06");
  form.set("subject", "Asunto corregido");
  form.set("subject_type", "otro");
  form.set("description", "Descripción corregida");
  form.set("alert_date", "2026-10-20");
  form.set("registered_by", String(admin.id));
  form.set("created_at", "2026-10-10T00:00:00");
  form.set("attended", "false");
  const props = {
    caseId: 1,
    actor: admin,
    item: entry,
    done: async () => {
      completed += 1;
    },
  };
  await EntryForm(props).props.submit(form);
  assert.equal(calls[0].url, "https://lexio.test/entries/7");
  assert.equal(calls[0].method, "PUT");
  assert.deepEqual(JSON.parse(calls[0].body), {
    action_date: "2026-10-06",
    subject: "Asunto corregido",
    subject_type: "otro",
    description: "Descripción corregida",
    alert_date: "2026-10-20",
  });
  form.set("alert_date", "");
  await EntryForm(props).props.submit(form);
  assert.deepEqual(JSON.parse(calls[1].body), {
    action_date: "2026-10-06",
    subject: "Asunto corregido",
    subject_type: "otro",
    description: "Descripción corregida",
    alert_date: null,
  });
  assert.equal(completed, 2);
});
test("editar actuaciones requiere permiso incluso si ya están atendidas", () => {
  const pending = {
    id: 7,
    case_id: 1,
    action_date: "2026-10-07",
    subject: "Escrito breve",
    subject_type: "legal",
    description: "Escrito",
    alert_date: "2026-10-15",
    attended: false,
    responsible_name: staff.name,
    created_at: "2026-10-09T02:30:00",
    can_attend: true,
  };
  const attended = { ...pending, id: 8, attended: true };
  const withoutAlert = {
    ...pending,
    id: 9,
    alert_date: null,
    can_attend: false,
  };
  const edited = [];
  const props = {
    entries: [pending, attended, withoutAlert],
    canEdit: true,
    canAttend: true,
    edit: (value) => edited.push(value),
    load: noop,
  };
  const html = render(EntryTable, props);
  assert.equal((html.match(/>Editar</g) || []).length, 3);
  assert.equal((html.match(/>Marcar atendido</g) || []).length, 1);
  const tree = formProps(EntryTable, props);
  findButtons({ props: tree }, "Editar").forEach((button) => {
    assert.equal(button.props.className, "secondary");
    button.props.onClick();
  });
  assert.deepEqual(edited, [pending, attended, withoutAlert]);
  assert.match(
    render(EntryTable, { ...props, busy: true }),
    /<button class="secondary" disabled="">Editar<\/button>/,
  );
  assert.doesNotMatch(
    render(EntryTable, { ...props, canEdit: false, canAttend: false }),
    />Editar<|Marcar atendido/,
  );
  assert.doesNotMatch(
    render(EntryTable, { ...props, edit: undefined }),
    />Editar</,
  );
});
test("bitácora permite atender únicamente obligaciones pendientes con permiso", () => {
  const entry = {
    id: 1,
    case_id: 1,
    action_date: "2026-10-08",
    subject: "Presentar escrito",
    subject_type: "legal",
    description: "Presentar escrito",
    alert_date: "2026-10-15",
    attended: false,
    responsible_name: "Abogado",
    created_at: "2026-10-08T15:00:00",
    client_code: client.code,
    client_name: client.name,
    process_type: item.process_type,
    can_attend: true,
  };
  const props = {
    entries: [entry],
    showClient: true,
    load: noop,
    openCase: noop,
  };
  assert.match(render(EntryTable, props), /Marcar atendido/);
  assert.match(
    render(EntryTable, {
      ...props,
      entries: [{ ...entry, subject_type: "otro" }],
    }),
    /Marcar atendido/,
  );
  assert.doesNotMatch(
    render(EntryTable, { ...props, entries: [{ ...entry, attended: true }] }),
    /Marcar atendido/,
  );
  assert.doesNotMatch(
    render(EntryTable, {
      ...props,
      entries: [{ ...entry, can_attend: false }],
    }),
    /Marcar atendido/,
  );
});
test("abonos van a primera cuota y distribuyen excedente con centavos exactos", () => {
  const quotas = [
    { id: 2, number: 2, balance: "500.00" },
    { id: 1, number: 1, balance: "500.00" },
  ];
  assert.deepEqual(automaticAllocations("400", quotas), { 1: "400.00" });
  assert.deepEqual(automaticAllocations("650", quotas), {
    1: "500.00",
    2: "150.00",
  });
  assert.deepEqual(automaticAllocations("500.01", quotas), {
    1: "500.00",
    2: "0.01",
  });
  assert.deepEqual(
    automaticAllocations("100", [{ ...quotas[1], balance: "0.00" }, quotas[0]]),
    { 2: "100.00" },
  );
});
test("abono es simple, automático por defecto y permite elegir primera cuota", async () => {
  const html = render(PaymentForm, { item, done: noop });
  assert.match(html, /Automático · primera cuota pendiente/);
  assert.match(html, /Aplicar primero a/);
  assert.doesNotMatch(html, /Comprobante|crédito|name="application/);
  const calls = capture({});
  await financeService.recordPayment(1, {
    payment_date: "2026-10-08",
    amount: "400.00",
    method: "Efectivo",
  });
  await financeService.recordPayment(1, {
    payment_date: "2026-10-08",
    amount: "200.00",
    method: "",
    installment_id: 2,
  });
  assert.equal(calls[0].url, "https://lexio.test/cases/1/payments");
  assert.equal(JSON.parse(calls[0].body).amount, "400.00");
  assert.equal("installment_id" in JSON.parse(calls[0].body), false);
  assert.equal(JSON.parse(calls[1].body).installment_id, 2);
});
test("alertas muestran solo el asunto y permiten atender Legal y Otro con permiso", () => {
  const entry = {
    id: 1,
    case_id: 1,
    client_code: client.code,
    client_name: client.name,
    case_code: item.code,
    process_type: item.process_type,
    kind: "legal",
    subject: "Presentar escrito",
    description: "Detalles extensos reservados a la bitácora",
    target_date: "2026-10-15",
    notice_date: "2026-10-08",
    anticipation: 5,
    urgent: false,
    responsible_name: "Abogado",
    entry_id: 1,
    can_attend: true,
  };
  const props = {
    data: [entry],
    busy: false,
    load: noop,
    openCase: noop,
  };
  assert.match(render(AlertTable, props), /Marcar leído/);
  assert.match(render(AlertTable, props), /Marcar atendido/);
  assert.match(render(AlertTable, props), /Presentar escrito/);
  assert.match(render(AlertTable, props), /CAS-000001 · Cobro de deuda/);
  assert.doesNotMatch(
    render(AlertTable, props),
    /Detalles extensos|Saldo de honorarios/,
  );
  const opened = [];
  findButtons(
    componentTree(AlertTable, {
      ...props,
      openCase: (id, tab) => opened.push([id, tab]),
    }),
    "Ver caso",
  )[0].props.onClick();
  assert.deepEqual(opened, [[1, "bitacora"]]);
  const other = render(AlertTable, {
    ...props,
    data: [{ ...entry, kind: "otro" }],
  });
  assert.match(other, />Otro</);
  assert.match(other, /Marcar atendido/);
  assert.doesNotMatch(
    render(AlertTable, { ...props, data: [{ ...entry, can_attend: false }] }),
    /Marcar atendido/,
  );
  assert.doesNotMatch(
    render(AlertTable, { ...props, data: [{ ...entry, urgent: true }] }),
    /Marcar leído/,
  );
  assert.doesNotMatch(
    render(AlertTable, {
      ...props,
      data: [{ ...entry, kind: "pago", balance: "999.00" }],
    }),
    /Marcar atendido|999|<th>Saldo/,
  );
});
test("Inicio muestra todas las alertas procesales y excluye cobros de la primera tabla", () => {
  const alerts = Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    case_id: item.id,
    case_code: item.code,
    process_type: item.process_type,
    client_code: client.code,
    client_name: client.name,
    kind: index % 2 ? "otro" : "legal",
    subject: `Asunto ${index + 1}`,
    description: "Detalle reservado",
    target_date: "2026-10-15",
    notice_date: "2026-10-08",
    anticipation: 5,
    urgent: false,
    responsible_name: staff.name,
    entry_id: index + 1,
    can_attend: true,
  }));
  alerts.push({
    ...alerts[0],
    id: 8,
    kind: "pago",
    subject: "No mezclar cobros",
  });
  const html = render(DashboardPage, {
    actor: staff,
    dashboard: { counts: {} },
    alerts,
    isAdmin: false,
    busy: false,
    load: noop,
    openCase: noop,
  });
  for (let index = 1; index <= 7; index++)
    assert.match(html, new RegExp(`Asunto ${index}`));
  assert.doesNotMatch(
    html,
    /No mezclar cobros|Detalle reservado|Alerta de cobros/,
  );
  const headers = [...html.matchAll(/<th>([^<]+)<\/th>/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(headers, [
    "Cliente y caso",
    "Alerta",
    "Vencimiento",
    "Abogado responsable",
    "Descripción corta",
    "Acciones",
  ]);
});
test("anticipaciones de 5, 3 y 1 días se muestran en Inicio antes del vencimiento", () => {
  const alerts = [5, 3, 1].map((anticipation) => ({
    id: anticipation,
    case_id: item.id,
    case_code: item.code,
    client_name: client.name,
    client_code: client.code,
    process_type: item.process_type,
    kind: "legal",
    subject: `Plazo ${anticipation}`,
    target_date: "2999-10-20",
    anticipation,
    urgent: false,
    responsible_name: admin.name,
  }));
  const html = render(DashboardPage, {
    actor: admin,
    dashboard: { counts: {}, upcoming_payments: [] },
    alerts,
    isAdmin: true,
    busy: false,
    load: noop,
    openCase: noop,
  });
  for (const anticipation of [5, 3, 1]) {
    assert.match(
      html,
      new RegExp(
        `Aviso de ${anticipation} ${anticipation === 1 ? "día hábil" : "días hábiles"}`,
      ),
    );
    assert.match(html, new RegExp(`Plazo ${anticipation}`));
  }
  assert.doesNotMatch(html, /alert-urgent|Urgente · vencido/);
});

test("cobros vencidos usan el mismo rojo y estado urgente que las alertas procesales", () => {
  const payments = ["2000-01-01", "2999-01-01"].map((due_date, index) => ({
    id: index + 1,
    case_id: item.id,
    case_code: item.code,
    client_name: client.name,
    client_code: client.code,
    process_type: item.process_type,
    number: index + 1,
    due_date,
    balance: "100.00",
  }));
  const html = render(DashboardPage, {
    actor: admin,
    dashboard: { counts: {}, upcoming_payments: payments },
    alerts: [],
    isAdmin: true,
    busy: false,
    load: noop,
    openCase: noop,
  });
  const rows = [...html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)].map(
    (match) => match[0],
  );
  const overdue = rows.find((row) => row.includes("Cuota 1"));
  const future = rows.find((row) => row.includes("Cuota 2"));
  assert.match(overdue, /class="alert-urgent"/);
  assert.match(overdue, /Urgente · vencido/);
  assert.doesNotMatch(future, /alert-urgent|Urgente/);
  assert.match(future, /Pendiente/);
});

test("modal selecciona varias cuotas incobrables con un motivo común y permite reactivarlas", async () => {
  const quota = { ...item.installments[0], uncollectible_reason: null };
  const quotas = [quota, item.installments[1]];
  const props = { caseId: item.id, quotas, done: async () => {} };
  const calls = capture(item);
  const form = new FormData();
  form.set("reason", " Cliente no pagará ");
  await assert.rejects(
    CollectionForm(props).props.submit(form),
    /Selecciona al menos una cuota/,
  );
  form.append("installment_ids", "1");
  form.append("installment_ids", "2");
  await CollectionForm(props).props.submit(form);
  assert.equal(calls[0].url, "https://lexio.test/cases/1/collection");
  assert.equal(calls[0].method, "PUT");
  assert.deepEqual(JSON.parse(calls[0].body), {
    installment_ids: [1, 2],
    reason: "Cliente no pagará",
  });
  form.set("reason", "  ");
  await assert.rejects(
    CollectionForm(props).props.submit(form),
    /Indica el motivo/,
  );
  assert.equal(calls.length, 1);
  const marked = {
    ...quota,
    state: "incobrable",
    uncollectible_reason: "Cliente no pagará",
  };
  form.delete("installment_ids");
  form.append("installment_ids", "1");
  await CollectionForm({
    ...props,
    quotas: [marked],
    restore: true,
  }).props.submit(form);
  assert.deepEqual(JSON.parse(calls[1].body), {
    installment_ids: [1],
    reason: null,
  });
  assert.match(
    render(CollectionForm, { ...props, quotas: [marked], restore: true }),
    /Reactivar cobranza|Cliente no pagará/,
  );
  const html = render(CollectionForm, {
    ...props,
    quotas: [
      ...quotas,
      { ...marked, id: 3, number: 3 },
      { ...quota, id: 4, number: 4, balance: "0.00" },
    ],
  });
  assert.match(html, /aria-label="Seleccionar cuota 1"/);
  assert.match(html, /aria-label="Seleccionar cuota 2"/);
  assert.doesNotMatch(html, /Seleccionar cuota 3|Seleccionar cuota 4/);
  form.set("installment_ids", "999");
  await assert.rejects(
    CollectionForm(props).props.submit(form),
    /Selecciona al menos una cuota/,
  );
  assert.equal(calls.length, 2);
});

test("incobrables conservan saldo visible solo al administrador y se excluyen de abonos", () => {
  const marked = {
    ...item,
    uncollectible: "100.00",
    balance: "500.00",
    installments: [
      {
        ...item.installments[0],
        state: "incobrable",
        uncollectible_reason: "Sin posibilidad de cobro",
      },
      item.installments[1],
    ],
  };
  const html = render(CaseWorkspace, {
    selected: marked,
    actor: admin,
    users: [],
    clients: [],
    areas,
  });
  assert.match(html, /Incobrable|Reactivar cobranza|Sin posibilidad de cobro/);
  assert.match(html, /Incobrable excluido/);
  assert.match(html, /Saldo exigible/);
  assert.doesNotMatch(html, /Incluye/);
  const plan = html.match(/<table>[\s\S]*?<\/table>/)[0];
  assert.doesNotMatch(plan, /<button|<th>Cobranza<\/th>/);
  assert.equal(
    (html.match(/>Marcar cuotas como incobrables<\/button>/g) || []).length,
    1,
  );
  assert.ok(
    html.indexOf("Marcar cuotas como incobrables") >
      html.indexOf("Abonos registrados"),
  );
  const buttons = findButtons(
    componentTree(CaseWorkspace, {
      selected: marked,
      actor: admin,
      users: [],
      clients: [],
      areas,
    }),
    "Marcar cuotas como incobrables",
  );
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props.className, "secondary");
  const staffHtml = render(CaseWorkspace, {
    selected: marked,
    actor: staff,
    users: [],
    clients: [],
    areas,
  });
  assert.doesNotMatch(
    staffHtml,
    /Incobrable|Reactivar cobranza|Sin posibilidad de cobro/,
  );
  const formHtml = render(PaymentForm, { item: marked, done: noop });
  assert.doesNotMatch(formHtml, /<option value="1"/);
  assert.match(formHtml, /<option value="2"/);
  assert.match(formHtml, /max="500.00"/);
  const allMarked = {
    ...marked,
    balance: "0.00",
    installments: marked.installments.map((q) => ({
      ...q,
      uncollectible_reason: "Motivo",
    })),
  };
  assert.doesNotMatch(
    render(CaseWorkspace, {
      selected: allMarked,
      actor: admin,
      users: [],
      clients: [],
      areas,
    }),
    /Registrar abono/,
  );
  assert.match(
    render(CaseWorkspace, {
      selected: allMarked,
      actor: admin,
      users: [],
      clients: [],
      areas,
    }),
    /Sin saldo exigible/,
  );
});

test("leer y atender usan endpoints independientes", async () => {
  const calls = capture({});
  await alertsService.read(5);
  await casesService.attendEntry(2);
  assert.deepEqual(
    calls.map((call) => [new URL(call.url).pathname, call.method]),
    [
      ["/alerts/5/read", "POST"],
      ["/entries/2/attend", "POST"],
    ],
  );
});
test("reporte único agrupa casos y financieras por rama respetando roles", async () => {
  const report = {
    rows: [
      {
        area: "Civil",
        total_cases: 1,
        active_cases: 1,
        concluded_cases: 0,
        withdrawn_cases: 0,
        fee: "1000",
        paid: "400",
        balance: "600",
      },
    ],
    totals: {
      total_cases: 1,
      active_cases: 1,
      concluded_cases: 0,
      withdrawn_cases: 0,
      fee: "1000",
      paid: "400",
      balance: "600",
    },
  };
  const props = { report, isAdmin: true, busy: false, load: noop };
  const html = render(Reports, props);
  assert.match(html, /Total facturado/);
  assert.match(html, /Retirados/);
  assert.match(html, /Efectivo cobrado/);
  assert.match(html, /Saldo exigible/);
  assert.match(
    html,
    /honorarios pactados − abonos registrados − saldo incobrable/,
  );
  assert.doesNotMatch(html, /Corte|Servicio|cutoff/);
  assert.doesNotMatch(
    render(Reports, { ...props, isAdmin: false }),
    /Total facturado|Efectivo cobrado|Saldo exigible|Saldo incobrable/,
  );
  const calls = capture(report);
  await reportsService.list();
  assert.equal(calls[0].url, "https://lexio.test/reports");
  await reportsService.list({ area_id: "1", month: "10", year: "2026" });
  assert.equal(
    calls[1].url,
    "https://lexio.test/reports?area_id=1&month=10&year=2026",
  );
  assert.match(html, /name="area_id"/);
  assert.match(html, /name="month"/);
  assert.match(html, /name="year"/);
});
test("administración muestra fecha y hora legibles sin recursos ni JSON", () => {
  const audit = [
    {
      id: 1,
      created_at: "2026-10-09T02:30:00",
      user_id: 1,
      user_name: "David",
      action: "Registró un abono",
      resource: "lexio_payments",
      changes: '{"amount":"400"}',
    },
  ];
  const html = render(AdministrationPage, {
    users: [admin, staff],
    areas: [{ id: 1, name: "Civil" }],
    audit,
    setEditUser: noop,
    setModal: noop,
  });
  assert.match(html, /8 de octubre de 2026/);
  assert.match(html, /9:30/);
  assert.equal((html.match(/title="Eliminar asistente"/g) || []).length, 1);
  assert.match(html, /aria-label="Eliminar a Abogado"/);
  assert.doesNotMatch(
    html,
    /lexio_payments|amount|Recurso|Registro UTC|Anticipación de avisos/,
  );
  const staffConfig = render(AdministrationPage, {
    actor: staff,
    users: [admin, staff],
    areas: [{ id: 1, name: "Civil" }],
    audit,
    setEditUser: noop,
    setModal: noop,
  });
  assert.match(staffConfig, /Datos de mi cuenta/);
  assert.match(staffConfig, /name="name"/);
  assert.match(staffConfig, /name="username"/);
  assert.match(staffConfig, /name="password"/);
  assert.doesNotMatch(
    staffConfig,
    /Usuarios del estudio|Ramas de derecho|Últimos cambios|can_create_clients|can_create_cases|Editar permisos/,
  );
});

test("administración muestra el catálogo y permite agregar una rama", async () => {
  const html = render(AdministrationPage, {
    users: [admin],
    audit: [],
    areas: [{ id: 7, name: "Derecho marítimo" }],
    setEditUser: noop,
    setModal: noop,
  });
  assert.match(html, /Ramas de derecho/);
  assert.match(html, /Agregar rama/);
  assert.match(html, /Derecho marítimo/);
  assert.match(
    render(AdministrationPage, {
      users: [],
      audit: [],
      areas: [],
      setEditUser: noop,
      setModal: noop,
    }),
    /Todavía no hay ramas/,
  );
  const calls = capture({ id: 7, name: "Derecho marítimo" });
  let refreshed = false;
  const form = new FormData();
  form.set("name", "  Derecho marítimo  ");
  const component = LegalAreaForm({
    done: async () => {
      refreshed = true;
    },
  });
  await component.props.submit(form);
  assert.equal(calls[0].url, "https://lexio.test/legal-areas");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(JSON.parse(calls[0].body), { name: "Derecho marítimo" });
  assert.equal(refreshed, true);
  form.set("name", "   ");
  await assert.rejects(component.props.submit(form), /Ingresa el nombre/);
  assert.equal(calls.length, 1);
});
test("fecha y hora se muestran en Perú con cambios de día y formatos UTC", () => {
  const local = dateTimeLabels("2026-10-09T02:30:00");
  assert.equal(local.date, "8 de octubre de 2026");
  assert.match(local.time, /9:30/);
  assert.deepEqual(dateTimeLabels("2026-10-09T02:30:00Z"), local);
  assert.deepEqual(dateTimeLabels("2026-10-08T21:30:00-05:00"), local);
  assert.equal(
    dateLabel("2026-10-08T21:30:00-05:00"),
    dateLabel("2026-10-09T02:30:00Z"),
  );
});
test("usuarios conservan contraseña mínima de seis y permisos sin correo de acceso", async () => {
  assert.match(render(UserForm, { done: noop }), /minLength="6"/i);
  const calls = capture({});
  const form = new FormData();
  form.set("name", "Juan");
  form.set("username", "juan");
  form.set("password", "fixture");
  await UserForm({ done: async () => {} }).props.submit(form);
  assert.equal(JSON.parse(calls[0].body).username, "juan");
  assert.equal("email" in JSON.parse(calls[0].body), false);
});
test("calendario en dashboard se ubica debajo de alertas procesales y organiza vista semanal y mensual", () => {
  const calendarAlerts = [
    {
      id: 101,
      case_id: item.id,
      case_code: item.code,
      process_type: item.process_type,
      client_code: client.code,
      client_name: client.name,
      kind: "legal",
      subject: "Presentar escrito de apelación",
      description: "Sin hora fija",
      target_date: "2026-10-15",
      target_time: null,
      notice_date: "2026-10-08",
      anticipation: 5,
      urgent: false,
      responsible_name: admin.name,
    },
    {
      id: 102,
      case_id: item.id,
      case_code: item.code,
      process_type: item.process_type,
      client_code: client.code,
      client_name: client.name,
      kind: "otro",
      subject: "Audiencia única virtual",
      description: "Con enlace de Google Meet",
      target_date: "2026-10-15",
      target_time: "09:30",
      notice_date: "2026-10-08",
      anticipation: 5,
      urgent: false,
      responsible_name: admin.name,
    },
  ];
  const dashHtml = render(DashboardPage, {
    actor: admin,
    dashboard: { counts: {}, upcoming_payments: [] },
    alerts: calendarAlerts,
    isAdmin: true,
    busy: false,
    load: noop,
    openCase: noop,
  });
  const alertsIdx = dashHtml.indexOf("Alertas procesales y otros");
  const calendarIdx = dashHtml.indexOf("Calendario de alertas");
  const paymentsIdx = dashHtml.indexOf("Alerta de cobros");
  assert.ok(alertsIdx >= 0 && calendarIdx > alertsIdx && paymentsIdx > calendarIdx);

  const weekHtml = render(AlertCalendar, {
    data: calendarAlerts,
    openCase: noop,
    initialView: "week",
    initialDate: "2026-10-15",
  });
  const allDaySection = weekHtml.split('data-section="time-grid"')[0];
  const timeGridSection = weekHtml.split('data-section="time-grid"')[1];
  assert.match(allDaySection, /Presentar escrito de apelación/);
  assert.doesNotMatch(allDaySection, /Audiencia única virtual/);
  assert.match(timeGridSection, /data-slot="2026-10-15T09"[\s\S]*?Audiencia única virtual/);
  assert.match(timeGridSection, /9:30/);

  const monthHtml = render(AlertCalendar, {
    data: calendarAlerts,
    openCase: noop,
    initialView: "month",
    initialDate: "2026-10-15",
  });
  assert.match(monthHtml, /data-section="month-grid"/);
  assert.match(
    monthHtml,
    /data-month-day="2026-10-15"[\s\S]*?Presentar escrito de apelación[\s\S]*?Audiencia única virtual/,
  );

  // El calendario usa calendarAlerts (todas las programadas) y por defecto abre en la semana/mes actual
  const defaultCurrentWeekHtml = render(AlertCalendar, {
    data: calendarAlerts,
    openCase: noop,
  });
  assert.match(defaultCurrentWeekHtml, /gcal-day-num-today/);
});
test("alertsService.listScheduled solicita todas las alertas programadas sin filtro de 5-3-1 días", async () => {
  const calls = capture([]);
  await alertsService.listScheduled();
  assert.equal(calls[0].url, "https://lexio.test/alerts?all_scheduled=true");
});
test("un caso puede vincular y mostrar múltiples clientes", async () => {
  const secondClient = {
    ...client,
    id: 2,
    code: "CL-000002",
    name: "Carlos Vega",
    document_number: "87654321",
  };
  const multiCase = {
    ...item,
    clients: [client, secondClient],
    client_ids: [1, 2],
    tracking_number: "01234-2026-0-1801-JR-CI-01",
  };
  const calls = capture(multiCase);
  const form = new FormData();
  form.set("client_id", "1");
  form.append("client_ids", "2");
  form.set("area_id", "1");
  form.set("process_type", "Sucesión intestada");
  form.set("tracking_number", "01234-2026-0-1801-JR-CI-01");
  form.set("initial_stage", "Demanda");
  form.set("status", "activo");
  form.set("fee", "1000.00");
  form.set("amount_0", "1000.00");
  form.set("due_date_0", "2026-10-15");

  await formProps(CaseForm, {
    actor: admin,
    clients: [client, secondClient],
    areas,
    saved: noop,
  }).submit(form);

  assert.deepEqual(JSON.parse(calls[0].body).client_ids, [1, 2]);
  assert.equal(JSON.parse(calls[0].body).client_id, 1);
  assert.equal(
    JSON.parse(calls[0].body).tracking_number,
    "01234-2026-0-1801-JR-CI-01",
  );

  const listHtml = render(CasesPage, {
    actor: admin,
    isAdmin: true,
    cases: [multiCase],
    areas,
    clients: [client, secondClient],
    busy: false,
    search: "",
    area: "",
    status: "",
    clientFilter: "",
    setSearch: noop,
    setArea: noop,
    setStatus: noop,
    setClientFilter: noop,
    load: noop,
    clearFilters: noop,
    openCase: noop,
    create: noop,
  });
  assert.match(listHtml, /Ana Torres/);
  assert.match(listHtml, /Carlos Vega/);
  assert.match(listHtml, /87654321/);

  const detailHtml = render(CaseWorkspace, {
    selected: multiCase,
    areas,
    actor: admin,
    users: [admin],
    clients: [client, secondClient],
    back: noop,
  });
  assert.match(detailHtml, /Ana Torres \/ Carlos Vega/);
  assert.match(detailHtml, /DNI · 12345678 \/ DNI · 87654321/);
  assert.match(detailHtml, /01234-2026-0-1801-JR-CI-01/);
  assert.match(listHtml, /Exp\. 01234-2026-0-1801-JR-CI-01/);

  const clientsHtml = render(ClientsPage, {
    actor: admin,
    clients: [client, { ...secondClient, is_delinquent: true }],
    busy: false,
    search: "",
    setSearch: noop,
    load: noop,
    create: noop,
    edit: noop,
    viewCases: noop,
    newCase: noop,
  });
  assert.match(
    clientsHtml,
    /<strong>Carlos Vega<\/strong><small class="delinquent-tag">Moroso<\/small>/,
  );
  assert.doesNotMatch(
    clientsHtml,
    /<strong>Ana Torres<\/strong><small class="delinquent-tag">Moroso<\/small>/,
  );
});
