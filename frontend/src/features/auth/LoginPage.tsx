import { Scale } from "lucide-react";
import { Field, Form } from "../../components/ui/index";
import type { LexioState } from "../../hooks/useLexio";
import { authService } from "../../services/auth";
import { setToken } from "../../services/http";
import { str } from "../../utils/form";

type Props = Pick<LexioState, "setActor">;
export default function LoginPage({ setActor }: Props) {
  return (
    <main className="login">
      <section className="login-brand">
        <div className="brand">
          <Scale size={36} />
          <span>
            Lexio<small>LEXCONTERRA GROUP</small>
          </span>
        </div>
        <p className="eyebrow">Control jurídico y gerencial</p>
        <h1>
          Tu estudio.
          <br />
          Cada caso, en orden.
        </h1>
        <p>
          Historia, vencimientos y gestión del estudio en un espacio de trabajo
          seguro.
        </p>
      </section>
      <section className="login-form">
        <div>
          <p className="eyebrow">Bienvenido a Lexio</p>
          <h2>Ingresa a tu estudio</h2>
          <p className="muted text-sm mb-8">
            Usa tu usuario y contraseña individual.
          </p>
          <Form
            label="Ingresar"
            submit={async (f) => {
              const result = await authService.login({
                username: str(f, "username"),
                password: str(f, "password"),
              });
              setToken(result.access_token);
              setActor(result.user);
            }}
          >
            <Field label="Usuario">
              <input
                type="text"
                name="username"
                autoComplete="username"
                required
                autoCapitalize="none"
                spellCheck={false}
                minLength={3}
                maxLength={50}
                placeholder="david"
              />
            </Field>
            <Field label="Contraseña">
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
              />
            </Field>
          </Form>
          <p className="text-xs muted mt-8">
            El administrador crea tu cuenta y autoriza tus casos.
          </p>
        </div>
      </section>
    </main>
  );
}
