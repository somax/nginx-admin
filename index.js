const fs = require('fs');
const path = require('path');
const qs = require('querystring');
const http = require('http');
const exec = require('child_process').execFile;

const VERSION =  require('./package.json').version;
const CONFIG = require('ez-config-loader')('config/config');

const PORT = CONFIG.port || 8000;
const CONFIG_PATH = prefixPath(CONFIG.configPath);
const NGINX_CMD = CONFIG.nginxCmd;

console.log('Config loaded:\n',CONFIG);

function prefixPath(_path) {
    return (/^\/./.test( _path)) ? _path : __dirname + '/' + _path + '/';
}

const nginxCommands = {
    'reload':(cb)=>{
        console.log('do nginx reload!');
        exec(NGINX_CMD,['-s','reload'],cb);
        // console.log(exec(NGINX_CMD,['-s','reloadd']).toString());
        // cb(false,'done');
    }
};

const apiHandler = {
    '/':{
        'GET':(req, done)=>{
            done({
                info:`Nginx Admin API! Version: ${VERSION}`,
                apis:['/api/conf']
            });
        }
    },
    '/api':{
        'GET':(req, done)=>{
            let _res;
            let _path = req._path;
            if(_path.base === 'conf'){
                _res = {
                    apis : '/api/conf/vhosts'
                };
            }else{
                _res = { 
                    statusCode: 404,
                    msg: 'not found!'
                };
            }
            done(_res);
        }
    },
    '/api/conf':{
        'GET': (req, done)=>{
            let _path = req._path;
            let _files = fs.readdirSync( CONFIG_PATH + _path.base);
            done({
                apis: _files.map(v=>`/api/conf/${_path.base}/${v}`)
            });
        }
    },
    '/api/conf/vhosts':{
        'GET': (req, done)=>{
            let _path = req._path;
            done({
                data: fs.readFileSync( CONFIG_PATH + '/vhosts/' + _path.base).toString()
            });
        },
        'POST': (req, done)=>{
            let body = '';
            let _path = req._path;

            req.on('data', function (data) {
                body += data;

                if (body.length > 1e6){
                    req.connection.destroy();
                }
            });

            req.on('end', function () {
                let post = qs.parse(body);
                fs.writeFileSync(CONFIG_PATH + '/vhosts/' + _path.base, post['conf']);
                done({ msg: 'ok' });
            });

        },
        'DELETE':(req, done)=>{
            let _path = req._path;
            fs.unlinkSync(CONFIG_PATH + _path.base);
            done({msg: 'deleted'});
        }
    },
    '/api/cmd':{
        'GET':(req, done)=>{
            let _path = req._path;
            let _cmd = _path.base;
            nginxCommands[_cmd]((err,_stdout,_stderr)=>{
                let _res = { cmd: _cmd };
                if(err){
                    _res.error = err;
                }
                _res.stdout = _stdout;
                _res.stderr = _stderr;
                done(_res);                
            });

        }
    }
};




// apiHandler['/api/conf/vhosts'].PUT = apiHandler['/api/conf/vhosts'].POST;

const httpServer = http.createServer((req, res) => {

    let _path = path.parse(req.url, true);
    req._path = _path;
    console.log(_path);

    if(/^\/api/.test(req.url)){
        try{

            apiHandler[_path.dir][req.method](req, (_res={}) => {
                if(_res.statusCode){
                    res.statusCode = _res.statusCode;
                }
                res.end(JSON.stringify(_res));
            });
        }catch(err){
            console.error(err);
            res.statusCode = 500;
            res.end(JSON.stringify({ msg: err.toString()}));
        }
    }else{
        let file;
        let url = (req.url == '/') ? './index.html' : '.' + req.url;
        try {
            file = fs.readFileSync(__dirname + '/www/' + url);
        } catch (err) {
            file = 'Not find: ' + url;
            res.statusCode = 404;
        }
        res.end(file);        
    }


});


httpServer.listen(PORT, () => console.log(`Listening on http://0.0.0.0:${PORT}`));
