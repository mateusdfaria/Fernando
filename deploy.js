const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function deploy() {
    const tryConnect = async (user, password) => {
        try {
            console.log(`Connecting as ${user}...`);
            await ssh.connect({
                host: '92.246.129.31',
                username: user,
                password,
                readyTimeout: 10000
            });
            console.log(`SUCCESS connected as ${user}!`);
            return true;
        } catch (e) {
            console.log(`Failed as ${user}:`, e.message);
            return false;
        }
    };

    const attempts = [
        { u: 'ubuntu', p: 'C7vVu5qOt6ZL12z7' },
        { u: 'bonsai', p: 'C7vVu5qOt6ZL12z7' },
        { u: 'root', p: 'C7vVu5qOt6ZL12z7' },
        { u: 'debian', p: 'C7vVu5qOt6ZL12z7' },
    ];

    for (let m of attempts) {
        if (await tryConnect(m.u, m.p)) {
            console.log('Executando git pull e pm2 restart...');
            const result = await ssh.execCommand('cd Fernando && git pull origin main && pm2 restart all');
            console.log('STDOUT:', result.stdout);
            console.log('STDERR:', result.stderr);
            ssh.dispose();
            return;
        }
    }

    console.log('Todas as tentativas de login falharam.');
    process.exit(1);
}

deploy();
