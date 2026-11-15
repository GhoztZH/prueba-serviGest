import Button from '@mui/material/Button';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { INICIO } from '../../../app/navigation';
import { useAuth } from '../../../app/providers/AuthProvider';
import { Campo, camposDe, mensajeGeneral } from '../../../shared/components/forms';
import { Aviso } from '../../../shared/components/layout';
import { useAccion } from '../../../shared/hooks/hooks';
import { authService } from '../services/auth.service';

/**
 * Pantallas de acceso. Figma no incluye un marco de inicio de sesión, así que
 * se componen con los átomos existentes (Campo, Botón, Aviso) y los tokens,
 * sin introducir colores ni tamaños nuevos.
 */
function MarcoAcceso({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <main className="acceso">
      <div className="tarjeta">
        <div className="marca">
          <span className="marca-logo" aria-hidden="true" />
          ServiGest
        </div>
        <h1 className="titulo-pagina">{titulo}</h1>
        <p className="tenue" style={{ marginBottom: 24 }}>
          {subtitulo}
        </p>
        {children}
      </div>
    </main>
  );
}

export function LoginPage() {
  const { usuario, iniciarSesion } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { ejecutar, enviando, error } = useAccion(iniciarSesion);
  const campos = camposDe(error);

  // Con sesión iniciada no tiene sentido ver el formulario.
  if (usuario) return <Navigate to={(ubicacion.state as { desde?: string } | null)?.desde ?? INICIO[usuario.rol]} replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const resultado = await ejecutar(email, password);
    if (resultado.ok) navegar((ubicacion.state as { desde?: string } | null)?.desde ?? '/', { replace: true });
  };

  return (
    <MarcoAcceso titulo="Iniciar sesión" subtitulo="Gestión de solicitudes de servicio técnico">
      <form className="pila" onSubmit={enviar} noValidate>
        {mensajeGeneral(error) && <Aviso tono="error" titulo={mensajeGeneral(error)} />}
        <Campo etiqueta="Correo de acceso" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={campos.email} autoFocus required />
        <Campo etiqueta="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={campos.password} required />
        <Button type="submit" size="large" fullWidth disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Button>
        <Link to="/recuperar" className="enlace" style={{ alignSelf: 'center' }}>
          Olvidé mi contraseña
        </Link>
      </form>
    </MarcoAcceso>
  );
}

export function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [respuesta, setRespuesta] = useState<{ message: string; tokenDesarrollo?: string } | null>(null);
  const { ejecutar, enviando, error } = useAccion(authService.olvidePassword);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const resultado = await ejecutar(email);
    if (resultado.ok) setRespuesta(resultado.valor);
  };

  return (
    <MarcoAcceso titulo="Recuperar acceso" subtitulo="Le enviaremos instrucciones para crear una contraseña nueva">
      {respuesta ? (
        <div className="pila">
          <Aviso tono="ok" titulo="Solicitud recibida">
            {respuesta.message}
          </Aviso>
          {/* El proyecto no integra servidor de correo: fuera de producción la API entrega el enlace. */}
          {respuesta.tokenDesarrollo && (
            <Link className="enlace" to={`/restablecer?token=${respuesta.tokenDesarrollo}`}>
              Continuar con el restablecimiento (entorno de desarrollo)
            </Link>
          )}
          <Link to="/login" className="enlace">
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <form className="pila" onSubmit={enviar} noValidate>
          {mensajeGeneral(error) && <Aviso tono="error" titulo={mensajeGeneral(error)} />}
          <Campo etiqueta="Correo de acceso" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={camposDe(error).email} autoFocus required />
          <Button type="submit" size="large" fullWidth disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar instrucciones'}
          </Button>
          <Link to="/login" className="enlace" style={{ alignSelf: 'center' }}>
            Volver a iniciar sesión
          </Link>
        </form>
      )}
    </MarcoAcceso>
  );
}

export function RestablecerPage() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [repetida, setRepetida] = useState('');
  const [listo, setListo] = useState(false);
  const { ejecutar, enviando, error } = useAccion(authService.restablecerPassword);
  const noCoincide = repetida !== '' && repetida !== password;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (noCoincide) return;
    if ((await ejecutar(token, password)).ok) setListo(true);
  };

  return (
    <MarcoAcceso titulo="Nueva contraseña" subtitulo="Mínimo 8 caracteres, con al menos una letra y un número">
      {listo ? (
        <div className="pila">
          <Aviso tono="ok" titulo="Contraseña actualizada">
            Ya puede iniciar sesión con su nueva contraseña.
          </Aviso>
          <Link to="/login" className="enlace">
            Ir a iniciar sesión
          </Link>
        </div>
      ) : (
        <form className="pila" onSubmit={enviar} noValidate>
          {mensajeGeneral(error) && <Aviso tono="error" titulo={mensajeGeneral(error)} />}
          {!token && <Aviso tono="error" titulo="El enlace no es válido">Solicite uno nuevo desde "Olvidé mi contraseña".</Aviso>}
          <Campo etiqueta="Nueva contraseña" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={camposDe(error).password} autoFocus required />
          <Campo etiqueta="Repita la contraseña" type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} error={noCoincide ? 'Las contraseñas no coinciden' : undefined} required />
          <Button type="submit" size="large" fullWidth disabled={enviando || !token || !password || noCoincide}>
            {enviando ? 'Guardando…' : 'Guardar contraseña'}
          </Button>
        </form>
      )}
    </MarcoAcceso>
  );
}
