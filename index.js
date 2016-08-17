const fs = require('fs');
const path = require('path');
const qs = require('querystring');
const http = require('http');

const VERSION =  require('./package.json').version;
const CONFIG = require('ez-config-loader')('config');

const PORT = CONFIG.port || 8000;
const CONFIG_PATH = prefixPath(CONFIG.configPath);

function prefixPath(_path) {
    return (/^\/./.test( _path)) ? _path : __dirname + '/' + _path + '/';
}


const apiHandler = {
    '/':{
        'GET':(req, _path, done)=>{
            done({
                info:`Nginx Admin API! Version: ${VERSION}`,
                apis:['/api/conf']
            });
        }
    },
    '/api':{
        'GET':(req, _path, done)=>{
            let _res;
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
        'GET': (req, _path, done)=>{
            let _files = fs.readdirSync( CONFIG_PATH + _path.base);
            done({
                apis: _files.map(v=>`/api/conf/${_path.base}/${v}`)
            });
        }
    },
    '/api/conf/vhosts':{
        'GET': (req, _path, done)=>{
            done({
                conf: fs.readFileSync( CONFIG_PATH + '/vhosts/' + _path.base).toString()
            });
        },
        'POST': (req, _path, done)=>{
            let body = '';

            req.on('data', function (data) {
                body += data;

                if (body.length > 1e6){
                    req.connection.destroy();
                }
            });

            req.on('end', function () {
                let post = qs.parse(body);
                // console.log(post);
                fs.writeFileSync(CONFIG_PATH + '/vhosts/' + _path.base, post['conf']);
                done({ msg: 'ok' });
            });

        },
        'DELETE':(req, _path, done)=>{
            fs.unlinkSync(CONFIG_PATH + _path.base);
            done({msg: 'deleted'});
        }
    }
};

// apiHandler['/api/conf/vhosts'].PUT = apiHandler['/api/conf/vhosts'].POST;

const httpServer = http.createServer((req, res) => {

    let _path = path.parse(req.url, true);
    console.log(_path);

    if(/^\/api/.test(req.url)){
        try{

            apiHandler[_path.dir][req.method](req, _path, (_res={}) => {
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
