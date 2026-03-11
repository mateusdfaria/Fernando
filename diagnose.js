const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function diagnose() {
    await ssh.connect({
        host: '92.246.129.31',
        username: 'root',
        password: 'C7vVu5qOt6ZL12z7',
        readyTimeout: 20000
    });

    console.log('Connected. Running diagnostics...\n');

    // Check server timezone and current time
    const dateResult = await ssh.execCommand('date && node -e "console.log(\'Node UTC:\', new Date().toISOString())"', { cwd: '/root/Fernando' });
    console.log('=== Server Date ===');
    console.log(dateResult.stdout);
    console.log(dateResult.stderr);

    // Check last few scheduled messages in database
    const dbResult = await ssh.execCommand(
        `node -e "
    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database('server/database.sqlite');
    db.all('SELECT id, scheduled_at, status, phones FROM scheduled_messages ORDER BY id DESC LIMIT 5', (err, rows) => {
      if (err) { console.error(err); process.exit(1); }
      console.log(JSON.stringify(rows, null, 2));
      db.close();
    });
    "`,
        { cwd: '/root/Fernando' }
    );
    console.log('\n=== Last 5 Scheduled Messages ===');
    console.log(dbResult.stdout);
    console.log(dbResult.stderr);

    // Check current file version (getPendingScheduledMessages)
    const grepResult = await ssh.execCommand("grep -n 'nowStr\\|datetime.*now' server/database.js", { cwd: '/root/Fernando' });
    console.log('\n=== getPendingScheduledMessages query in server ===');
    console.log(grepResult.stdout || '(empty)');

    // Check git log
    const gitLog = await ssh.execCommand('git log --oneline -5', { cwd: '/root/Fernando' });
    console.log('\n=== Git log (last 5 commits) ===');
    console.log(gitLog.stdout);

    ssh.dispose();
}

diagnose().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
