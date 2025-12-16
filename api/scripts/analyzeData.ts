import sqlite3 from "sqlite3";
import { open } from 'sqlite';

async function inspect(dbPath: string) {
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log(`Connected to ${dbPath}`);

    const tables = await db.all("select name from sql_master where type='table'");
    console.log('\nTables:');
    console.table(tables);
    console.log('\n');

    for (const t of tables) {
        const tableName = t.name;

        if (tableName.startsWith('vec_')) {
            // skipping sqlit-vec tables
            continue;
        }

        const schema = await db.all(`pragma table_info(${tableName})`);
        console.log(`Schema for ${tableName}`);
        console.table(schema);

        const rowCount = await db.get(`select count(*) as total from ${tableName}`)
        console.log(`\n row count for ${tableName} ${rowCount}`);

        const rows = await db.all(`SELECT * FROM ${tableName} LIMIT 20;`);
        console.log(`\nfirst 20 rows in ${tableName}`);
        console.table(rows);
        db.close();
    }
}

inspect('../db/movies.db');

