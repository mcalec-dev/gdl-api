const { spawn } = require('child_process');
const debug = require('debug')('gdl-api:startup');

// Function to start a process and handle its output
function startProcess(name, command, args) {
    const process = spawn(command, args, {
        stdio: 'pipe',
        shell: true
    });

    process.stdout.on('data', (data) => {
        console.log(`[${name}] ${data.toString().trim()}`);
    });

    process.stderr.on('data', (data) => {
        console.error(`[${name}] ${data.toString().trim()}`);
    });

    process.on('close', (code) => {
        console.log(`[${name}] Process exited with code ${code}`);
    });

    return process;
}

// Start both the API server and Discord bot
console.log('Starting GDL-API services...');

const apiServer = startProcess('API', 'node', ['server.js']);
const discordBot = startProcess('Discord', 'node', ['discord/index.js']);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nGracefully shutting down...');
    apiServer.kill();
    discordBot.kill();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nGracefully shutting down...');
    apiServer.kill();
    discordBot.kill();
    process.exit(0);
});