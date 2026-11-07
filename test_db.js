const db = require('./src/shared/config/database');

async function test() {
    try {
        const tables = ['Matricula', 'Detalles_Matricula', 'Metodo_Contacto', 'Disciplina_Horario', 'Horarios'];
        for (const t of tables) {
            const res = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'Academia Forca&Fitness' AND table_name = '${t}'`);
            console.log(`Columnas de ${t}:`, res.rows.map(r=>r.column_name));
        }
    } catch(e) { console.error(e); } finally { process.exit(); }
}
test();
