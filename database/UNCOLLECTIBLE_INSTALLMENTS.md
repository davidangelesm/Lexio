# Cuotas incobrables

Antes de desplegar este backend, revisar y aplicar una sola vez
`007_uncollectible_installments.sql` en MySQL. Esta entrega no aplica la migración.
No ejecutar el esquema inicial ni `reset_demo_schema.py` sobre una base con datos.
Pausar las escrituras durante el cambio; MySQL confirma DDL automáticamente.
La migración agrega dos campos opcionales sin modificar registros existentes.

El administrador marca una cuota desde Control financiero con un motivo obligatorio
de hasta 500 caracteres. Se conserva el importe, vencimiento, vínculo por evento,
abonos y saldo. La auditoría registra la decisión y su reversión.
Una cuota pagada no puede marcarse incobrable. Para modificar o retirar una cuota
incobrable hay que reactivar su cobranza primero; las restricciones de cuotas con
abonos siguen vigentes.

Las cuotas incobrables se excluyen de Inicio, avisos de pago y distribución de
nuevos abonos. Para recibir un pago inesperado, reactivar primero la cobranza.
La activación de su evento conserva el historial, sin generar avisos de cobro.
Los asistentes no reciben información financiera.

Saldo exigible = honorarios − abonos − incobrables. Incobrable es el importe sin
pagar de las cuotas marcadas y se muestra separado del saldo exigible. El campo
`balance` de casos, Inicio y Reportes representa el saldo exigible. Cada cuota
conserva su importe sin pagar y estado Incobrable para mantener el historial.
Marcar incobrable no registra un abono: los honorarios pactados y el efectivo
cobrado se conservan. Si no queda saldo exigible, el caso muestra "Sin saldo
exigible"; "Cancelado" se reserva para un caso íntegramente pagado. Reactivar la
cobranza vuelve a sumar el importe pendiente al saldo exigible. Reportes muestra
el saldo incobrable por rama y en el total.

Ejemplo: honorarios S/ 1,000, abonos S/ 100 y saldo incobrable S/ 400 dan un saldo
exigible de S/ 500. Abonar esos S/ 500 deja el exigible en cero y conserva los
S/ 400 incobrables. Reactivar la cuota vuelve a hacer exigible ese importe.

Las anticipaciones continúan en 5, 3 y 1 días hábiles de lunes a viernes sin
feriados. Inicio conserva solo el último aviso por obligación; leerlo no hace
reaparecer los anteriores. Al pasar el vencimiento, el aviso es urgente.
Alerta de cobros conserva su ventana de 30 días y marca en rojo los vencidos.

El 12 de octubre se verificó, mediante lecturas de Railway, que las actuaciones
pendientes con alerta tenían fechas del 9 y 10 de octubre. Por eso las alertas
visibles eran vencidas. Las pruebas temporales cubren actuaciones Legal/Otro y
cuotas con anticipaciones futuras para ambos roles y aislamiento entre estudios.

Verificación de esta entrega: 118 pruebas backend y 45 frontend aprobadas,
TypeScript/Vite y ejecutable Tauri compilados, e instalador NSIS generado.
El recorrido visual se comprobó con un caso, cuatro cuotas y cuatro actuaciones
en una base temporal local que se elimina al cerrar el servidor de pruebas.
Se verificaron los tres avisos anticipados, cobros vencidos en rojo, marcar y
reactivar una cuota y su exclusión/reaparición en Inicio.
No se instaló el ejecutable ni se desplegó Railway. La cobranza incobrable requiere
la migración 007 antes de actualizar el backend de Railway.
