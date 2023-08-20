const fs = require('fs');
const {spawn} = require('child_process');
const ignore = {
    directory: ['node_modules', 'public', '.git', '.idea', 'debug'],
    extensions: [],
    files: ['hot-reload.js']
};
const watch = ['.js'];
let node = start();

function recurse(path) {
    fs.readdir(path, function (err, files) {
        for (let f in files) {
            const file = files[f];
            if (fs.lstatSync(path + file).isDirectory()) {
                if (!ignore.directory.includes(file)) recurse(path + file + '/');
            } else {
                const extension = file.substring(file.indexOf('.'));
                if (watch.includes(extension) && !ignore.files.includes(file)) {
                    fs.watchFile(path + file, {interval: 1000}, () => {
                        reload();
                    });
                }
            }
        }
    });
}

recurse('./');

function reload() {
    if (node) {
        // noinspection JSCheckFunctionSignatures
        node.kill('SIGKILL');
    }
    node = null;
    setTimeout(function () {
        if (!node) node = start();
    }, 1000);
}

function start() {
    const process = spawn('node', ['index.js', 'dev=true']);

    process.stdout.on('data', (data) => {
        console.log(data.toString())
    });

    process.stderr.on('data', (data) => {
        console.log(data.toString())
    });

    process.on('error', () => {
    });

    process.on('close', () => {
    });

    return process;
}
