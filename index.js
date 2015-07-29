var express = require('express');
var app = express();
var path = require('path');
var fs = require('fs');
var byline = require('byline');
var multer = require('multer');
var upload = multer({ dest: 'uploads/' });
var _ = require('lodash');
var bodyParser = require('body-parser');
var shell = require('shelljs');

var device;

fs.readFile(path.join(__dirname, 'device.json'), function(err, data) {
  if (!err) {
    device = JSON.parse(data);
  }
});

shell.exec('sudo /etc/init.d/lirc restart');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/upload', upload.single('file'), function(req, res) {
  var file = fs.readFileSync(path.join(__dirname, req.file.path)).toString();
  var lines = file.split('\n');

  var name = null;
  var codes = [];

  var inCodesSection = false;

  for (var i = 0; i < lines.length; ++i) {
    var line = lines[i].trim();

    if (_.startsWith(line, 'name')) {
      name = line.match(/\S+/g)[1];
    }

    if (_.startsWith(line, 'end codes')) {
      inCodesSection = false;
    }

    if (inCodesSection) {
      codes.push(line.match(/\S+/g)[0]);
    }

    if (_.startsWith(line, 'begin codes')) {
      inCodesSection = true;
    }
  }

  shell.exec('sudo /etc/init.d/lirc stop');
  shell.exec('sudo mv ' + path.join(__dirname, req.file.path) + ' /etc/lirc/lircd.conf');
  shell.exec('sudo /etc/init.d/lirc start');

  device = {
    name: name,
    codes: codes
  };

  fs.writeFile(path.join(__dirname, 'device.json'), JSON.stringify(device), function(err) {
    if (err) {
      console.log(err);
    } else {
      shell.exec('sudo cp ' + path.join(__dirname, 'device.json') + ' ' + path.join(__dirname, 'uploads', name));
    }
  });

  res.redirect('/remote');
});

app.get('/remote', function(req, res) {
  res.sendFile(path.join(__dirname, 'remote.html'));
});

app.get('/devices', function(req, res) {
  var files = fs.readdirSync(path.join(__dirname, 'uploads'));
  res.json(files);
});

app.post('/devices', function(req, res) {
  var device = req.body.device;
  var file = fs.readFileSync(path.join(__dirname, 'uploads', device)).toString();

  device = JSON.parse(file);
  res.json(device);
});

app.get('/device', function(req, res) {
  res.json(device);
});

app.post('/device', function(req, res) {
  var name = req.body.name;
  var code = req.body.code;

  var result = shell.exec('irsend SEND_ONCE ' + name + ' ' + code).code;

  var payload = {
    result: result
  };

  res.json(payload);
});

app.get('/power/reboot', function(req, res) {
  var output = shell.exec('sudo reboot').output;
  res.send(output);
});

app.get('/power/shutdown', function(req, res) {
  var output = shell.exec('sudo shutdown -h now').output;
  res.send(output);
});

var server = app.listen(5000, function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});
