const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function deploy() {
    const tryConnect = async (user, useKey) => {
        try {
            console.log(`Connecting as ${user} using ${useKey ? 'key' : 'password'}...`);
            await ssh.connect({
                host: '92.246.129.31',
                username: user,
                ...(useKey ? { privateKeyPath: 'Fernando-servidor.ppk' } : { password: 'C7vVu5qOt6ZL12z7' }),
                readyTimeout: 10000
            });
            console.log(`SUCCESS connected as ${user}!`);
            return true;
        } catch (e) {
            console.log(`Failed as ${user}:`, e.message);
            return false;
        }
    };

    const methods = [
        { u: 'ubuntu', k: true },
        { u: 'ubuntu', k: false },
        { u: 'debian', k: true },
        { u: 'bonsai', k: false }
    ];

    for (let m of methods) {
        if (await tryConnect(m.u, m.k)) {
            console.log('Executing commands...');
            const result = await ssh.execCommand('cd Fernando && git pull origin main && pm2 restart all');
            console.log('STDOUT:', result.stdout);
            console.log('STDERR:', result.stderr);
            ssh.dispose();
            return;
        }
    }

    console.log('All login attempts failed.');
    process.exit(1);
}

deploy();
