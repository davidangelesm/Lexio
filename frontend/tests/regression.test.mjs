import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { api, setToken } from "../src/services/http.ts";
import { authService } from "../src/services/auth.ts";
import { clientsService } from "../src/services/clients.ts";
import { casesService } from "../src/services/cases.ts";
import { financeService } from "../src/services/finance.ts";
import { reportsService } from "../src/services/reports.ts";
import { openPrivateFile } from "../src/services/files.ts";
import App from "../src/app/App.tsx";
import AppShell from "../src/components/layout/AppShell.tsx";
import AlertTable from "../src/features/alerts/components/AlertTable.tsx";
import CaseServices from "../src/features/cases/components/CaseServices.tsx";
import ResponsibleSelect from "../src/features/cases/components/ResponsibleSelect.tsx";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  setToken("");
});
const noop = () => {};
function capture(response = {}) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return Response.json(response);
  };
  return calls;
}
const user = { id: 1, name: "David", role: "admin", active: true };

test("HTTP conserva JWT en memoria, cuerpo JSON y timeout", async () => {
  const calls = capture({ id: 7 });
  setToken("test-token");
  assert.deepEqual(await api("/clients", "POST", { name: "Cliente" }), {
    id: 7,
  });
  assert.equal(calls[0].url, "https://lexio.test/clients");
  assert.equal(calls[0].headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(calls[0].body), { name: "Cliente" });
  assert.ok(calls[0].signal instanceof AbortSignal);
});
test("login usa el endpoint y las credenciales originales", async () => {
  const result = { access_token: "token", user };
  const calls = capture(result);
  assert.deepEqual(
    await authService.login({
      email: "test@example.test",
      password: "fixture",
    }),
    result,
  );
  assert.equal(calls[0].url, "https://lexio.test/auth/login");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.Authorization, undefined);
});
test("401 invalida el token y comunica expiración de sesión", async () => {
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
test("errores Pydantic mantienen campo y mensaje", async () => {
  globalThis.fetch = async () =>
    Response.json(
      { detail: [{ loc: ["body", "email"], msg: "Correo inválido" }] },
      { status: 422 },
    );
  await assert.rejects(api("/auth/login"), /email: Correo inválido/);
});
test("filtros omiten valores vacíos y codifican caracteres", async () => {
  const calls = capture([]);
  await clientsService.list({ q: "Ana & José", document_type: "" });
  await casesService.list();
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get("q"), "Ana & José");
  assert.equal(url.searchParams.has("document_type"), false);
  assert.equal(new URL(calls[1].url).pathname, "/cases");
});
test("crear y editar actuaciones, tareas y eventos mantienen el caso y método", async () => {
  const calls = capture();
  for (const [method, route, data] of [
    [
      "saveEntry",
      "entries",
      {
        action_date: "2026-10-06",
        description: "Actuación",
        is_payment_event: false,
      },
    ],
    [
      "saveTask",
      "tasks",
      {
        description: "Tarea",
        responsible_id: 1,
        due_date: "2026-10-07",
        status: "pendiente",
        entry_id: null,
      },
    ],
    [
      "saveEvent",
      "events",
      {
        description: "Audiencia",
        entry_id: null,
        scheduled_date: null,
        effective_date: null,
        effective_kind: null,
      },
    ],
  ]) {
    await casesService[method](42, undefined, data);
    await casesService[method](42, 9, data);
    const [create, edit] = calls.splice(0);
    assert.equal(create.url, `https://lexio.test/cases/42/${route}`);
    assert.equal(create.method, "POST");
    assert.equal(edit.url, `https://lexio.test/cases/42/${route}/9`);
    assert.equal(edit.method, "PUT");
    assert.deepEqual(JSON.parse(edit.body), data);
  }
});
test("pagos conservan importes decimales como texto y aplicaciones", async () => {
  const calls = capture();
  const applications = [{ installment_id: 8, amount: "125.30" }];
  await financeService.recordPayment(4, {
    payment_date: "2026-10-06",
    amount: "200.00",
    method: "Transferencia",
    receipt: "",
    observation: "",
    applications,
  });
  await financeService.applyCredit(5, { applications });
  await financeService.reversePayment(5, { reason: "Pago duplicado" });
  assert.equal(calls[0].url, "https://lexio.test/services/4/payments");
  assert.equal(JSON.parse(calls[0].body).amount, "200.00");
  assert.deepEqual(JSON.parse(calls[0].body).applications, applications);
  assert.equal(calls[1].url, "https://lexio.test/payments/5/apply");
  assert.equal(calls[2].url, "https://lexio.test/payments/5/reverse");
});
test("confirmar, vincular y reprogramar cuotas mantienen sus endpoints", async () => {
  const calls = capture();
  await financeService.confirmInstallment(8);
  await financeService.linkInstallmentEvent(8, { event_id: 9 });
  await financeService.rescheduleInstallment(8, {
    due_date: "2026-10-20",
    reason: "Acuerdo con cliente",
  });
  assert.deepEqual(
    calls.map((c) => [new URL(c.url).pathname, c.method]),
    [
      ["/installments/8/confirm", "POST"],
      ["/installments/8/event", "PUT"],
      ["/installments/8/reschedule", "PUT"],
    ],
  );
});
test("reportes mantienen cortes y filtros enviados a FastAPI", async () => {
  const calls = capture();
  await reportsService.economic({
    cutoff: "2026-10-06",
    client_id: "3",
    case_id: "",
    service_id: "",
  });
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/reports/economic");
  assert.equal(url.searchParams.get("cutoff"), "2026-10-06");
  assert.equal(url.searchParams.has("case_id"), false);
});
test("archivo privado obtiene autorización de la API antes de abrir el enlace", async () => {
  const calls = capture({ url: "https://drive.google.com/file/fixture" });
  const opened = [];
  globalThis.window = { open: (...args) => opened.push(args) };
  await openPrivateFile(6);
  assert.equal(calls[0].url, "https://lexio.test/files/6/open");
  assert.deepEqual(opened[0], [
    "https://drive.google.com/file/fixture",
    "_blank",
    "noopener,noreferrer",
  ]);
});
test("la aplicación inicia en login y monta el elemento existente", async () => {
  const html = renderToStaticMarkup(createElement(App));
  assert.match(html, /Ingresa a tu estudio/);
  assert.match(html, /name="password"/);
  const entry = await readFile(
    new URL("../src/main.tsx", import.meta.url),
    "utf8",
  );
  const document = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  const id = entry.match(/getElementById\("([^"]+)"\)/)[1];
  assert.ok(document.includes(`id="${id}"`));
});
test("navegación conserva administración solo para administrador", () => {
  const props = {
    actor: user,
    page: "panel",
    onNavigate: noop,
    onLogout: noop,
    children: "Contenido",
  };
  assert.match(
    renderToStaticMarkup(createElement(AppShell, props)),
    /title="Administración"/,
  );
  assert.doesNotMatch(
    renderToStaticMarkup(
      createElement(AppShell, { ...props, actor: { ...user, role: "staff" } }),
    ),
    /title="Administración"/,
  );
});
test("tabla de alertas oculta saldos al equipo jurídico", () => {
  const data = [
    {
      id: 1,
      case_id: 42,
      client: { name: "Cliente", code: "CL1" },
      case_code: "CA1",
      description: "Obligación",
      kind: "pago",
      target_date: "2026-10-07",
      responsible_id: 1,
      amount: "9876.54",
      label: "Próximo",
      read_at: null,
    },
  ];
  const props = {
    data,
    isAdmin: false,
    busy: false,
    openCase: noop,
    userName: () => "David",
    setError: noop,
    load: noop,
  };
  const staff = renderToStaticMarkup(createElement(AlertTable, props));
  assert.doesNotMatch(staff, /<th>Saldo<\/th>/);
  assert.doesNotMatch(staff, /9[,.]876/);
  assert.match(
    renderToStaticMarkup(
      createElement(AlertTable, { ...props, isAdmin: true }),
    ),
    /<th>Saldo<\/th>/,
  );
});
test("servicios no muestran honorarios ni acciones financieras a staff", () => {
  const props = {
    isAdmin: false,
    services: [
      {
        id: 1,
        scope: "Defensa",
        stage: "Inicial",
        mode: "etapa",
        contract_date: "2026-10-06",
        fee: "9876.54",
        installments: [],
        payments: [],
      },
    ],
  };
  const staff = renderToStaticMarkup(createElement(CaseServices, props));
  assert.match(staff, /Defensa/);
  assert.doesNotMatch(staff, /Registrar abono|Contratar servicio|9[,.]876/);
  assert.match(
    renderToStaticMarkup(
      createElement(CaseServices, { ...props, isAdmin: true }),
    ),
    /Registrar abono/,
  );
});
test("selector de responsables conserva usuarios autorizados por rol", () => {
  const users = [
    user,
    { ...user, id: 2, name: "Responsable", role: "staff" },
    { ...user, id: 3, name: "Otro", role: "staff" },
  ];
  const props = {
    actor: users[1],
    users,
    isAdmin: false,
    authorized: [user, users[1]],
    caseData: { responsible_id: 2 },
    tasks: [],
  };
  assert.doesNotMatch(
    renderToStaticMarkup(createElement(ResponsibleSelect, props)),
    /Otro/,
  );
  assert.match(
    renderToStaticMarkup(
      createElement(ResponsibleSelect, { ...props, isAdmin: true }),
    ),
    /David/,
  );
});
