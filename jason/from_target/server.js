var http = require('http')
var fs = require('fs');
var serialize = require('node-serialize');
var url = require('url');
var xssFilters = require('xss-filters');

http.createServer(onRequest).listen(80);
console.log('Server has started');

let $ = require('cheerio').load(fs.readFileSync('index.html'));


function onRequest(request, response){
        if(request.url == "/" && request.method == 'GET'){
                if(request.headers.cookie){
                        var cookie = request.headers.cookie.split('=');
                        if(cookie[0] == "session"){
                                var str = new Buffer(cookie[1], 'base64').toString();
                                var obj = {"email": "guest"};
                                try {
                                        obj = serialize.unserialize(str);
                                }
                                catch (exception) {
                                        console.log(exception);
                                }
                                var email = xssFilters.inHTMLData(obj.email).substring(0,20);
                                $('h3').replaceWith(`<h3>We'll keep you updated at: ${email}</h3>`);
                        }
                }else{
                        $('h3').replaceWith(`<h3>Coming soon! Please sign up to our newsletter to receive updates.</h3>`);
                }
        }else if(request.url.includes("?email=") && request.method == 'POST'){
                console.log("POSTED email!");
                var qryObj = url.parse(request.url,true).query;
                var email = qryObj.email;
                var data = `{"email":"${email}"}`;
                var data64 = new Buffer(data).toString('base64');
                response.setHeader('Set-Cookie','session='+data64+'; Max-Age=900000; HttpOnly, Secure');
        }
        response.writeHeader(200, {"Content-Type": "text/html"});
        response.write($.html());
        response.end();
}
