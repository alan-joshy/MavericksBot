const sqlite3 = require('sqlite3').verbose();

// Connect to the SQLite database
const db = new sqlite3.Database('users.db');

// Fetch and display all rows from the userStates table
db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) {
        throw err;
    }
    // Display the results
    rows.forEach((row) => {
        console.log(row);
    });

});
