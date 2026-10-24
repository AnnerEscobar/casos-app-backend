# Informes fuera del alcance de esta versión

SGIC V3 no elabora informes dentro de la aplicación. Se retiraron el módulo Nest,
sus rutas `/informes`, el modelo, los DTO, la generación de Word y sus recursos.
La dependencia `docx` también se retiró del manifiesto y del archivo de bloqueo.

El frontend ya no ofrece creación ni pendientes de informes y no convierte un
informe pendiente en un caso. El registro normal de casos y sus borradores siguen
funcionando, al igual que carátula, plan, rúbrica y entrega del expediente en PDF.
Los informes que formen parte del expediente se elaboran fuera de SGIC y pueden
incluirse en ese PDF. Las fechas y los datos de informes en las fichas y rúbricas
siguen siendo información del expediente.

Esta retirada de código no borra documentos previamente guardados en MongoDB ni
archivos en Drive. Tampoco elimina eventos de auditoría: el filtro histórico
`Informe` permite seguir consultándolos. La aplicación deja de registrar el modelo
y no vuelve a crear la colección `informes` al arrancar.

No se requiere una migración de datos. Los roles ya asignados no se modifican;
el script de configuración para instalaciones nuevas deja de conceder permisos
para `informes`.
