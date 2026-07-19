const mysql = require('mysql2/promise');

async function checkDb() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'huongcaoha',
            password: '12345678',
            database: 'project_ojt'
        });

        const [tables] = await connection.execute('SHOW TABLES');
        console.log("Tables in project_ojt:", tables);

        for (const row of tables) {
            const tableName = Object.values(row)[0];
            const [data] = await connection.execute(`SELECT * FROM ${tableName} LIMIT 5`);
            if (data.length > 0) {
                console.log(`\n--- Data in ${tableName} ---`);
                console.log(data);
            }
        }

        await connection.end();
    } catch (e) {
        console.error("DB Error:", e);
    }
}

checkDb();
