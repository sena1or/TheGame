/**
 * Module dependencies.
 */

var express = require('express');
var hash = require('./pass').hash;
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var url = require("url");
var BANED = -1;
var USER = 0;
var MODERATOR = 1;
var ADMIN = 2;

var MAX_TABLE_CAPACITY = 6;

require('jade');

var app = module.exports = express();

// config

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
// middleware

app.use(bodyParser());
app.use(cookieParser('shhhh, very secret'));
app.use(session());

// Session-persisted message middleware

app.use(function(req, res, next) {
  var err = req.session.error;
  var msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
  if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
  next();
});


var users = {};
var tables = {};
var support = Array();
var explain = {}
explain[-1] = 'baned';
explain[0] = 'user'
explain[1] = 'moderator';
explain[2] = 'admin';


function createUser(Uname, pass, access_, email)
{
  users[Uname] = {name: Uname };
  hash(pass, function(err, salt, hash){
    if (err) throw err;
    users[Uname].salt = salt;
    users[Uname].hash = hash;
    users[Uname].money = 100;
    users[Uname].access = access_;
    users[Uname].email = email;
  });    
}

function createTable(Tname, stake, timeout)
{
    tables[Tname] = { id: Tname };
    tables[Tname].stake = stake;
    tables[Tname].timeout = timeout;
    tables[Tname].counter = 0;
    tables[Tname].users = Array();
    tables[Tname].lastWinner = "No game yet";
    setInterval(function()
    {
      console.log('Table played %s', Tname); 
      if(tables[Tname].users.length == 0)
	console.log('empty table');
      else
      {
	var win = Math.floor(Math.random() * (tables[Tname].users.length));
	users[tables[Tname].users[win].name].money += stake * tables[Tname].users.length * 0.99;
	tables[Tname].lastWinner = tables[Tname].users[win].name; 
      }
      tables[Tname].users = Array();
      
    }, timeout * 1000);
}

createUser('baned','baned', BANED, 'banned@mail.ru');
createUser('test','test', USER, 'banned@mail.ru');
createUser('moder','moder', MODERATOR, 'banned@mail.ru');
createUser('admin','admin',ADMIN, 'banned@mail.ru');
createTable('test',11,10);


function authenticate(name, pass, fn) {
  if (!module.parent) console.log('authenticating %s:%s', name, pass);
  var user = users[name];
  if (!user) return fn(new Error('cannot find user'));
  hash(pass, user.salt, function(err, hash){
    if (err) return fn(err);
    if (hash == user.hash) return fn(null, user);
    fn(new Error('invalid password'));
  });
}

function restrict(req, res, access_level, next ) {
  setAccess(req, res)
  if (!req.session.user) {
    req.session.error = ('Login please');
    res.redirect('/login');
  } 
  else  if(req.session.user.access < access_level) {
    req.session.error = ('Access denied!');
    res.redirect('/login');
  }
  else
  {
    next(req);
  }
}


app.get('/', function(req, res){
  setAccess(req, res);
  res.render('main');
});

app.get('/logout', function(req, res){
  req.session.destroy(function(){
    res.redirect('/');
  });
});
function setAccess(req, res) {
  if(req.session.user == null)
    res.locals.access = -1;
  else
    res.locals.access = req.session.user.access;
}
app.get('/login', function(req, res){
  setAccess(req, res)
  if(req.session.user == null) 
    res.render('login');
  else
    res.redirect('/tables');
});

app.post('/login', function(req, res){
  authenticate(req.body.username, req.body.password, function(err, user){
    if (user) {
      if (user.access == BANED) {
	req.session.error = ('You are banned');
	res.redirect('login');
	return ;
      }
      req.session.regenerate(function(){
        req.session.user = user;
        req.session.success = 'Authenticated as ' + user.name
          + 'You have money =' + user.money 
          + ' click to <a href="/logout">logout</a>. ';
        res.redirect('back');
      });
    } else {
      req.session.error = ('Authentication failed, please check your '
        + ' username and password.');
      res.redirect('login');
    }
  });
});

app.get('/register', function(req, res){
  setAccess(req, res)
  res.render('register');
});
app.post('/register', function(req, res){
  var filter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;

  Uname = req.body.username;
  pass = req.body.password;
  email = req.body.email;
  if(users[Uname] != null) {
    req.session.error = 'User already exist';
    res.redirect('back');
  }
  else if(!filter.test(email))
  {
    req.session.error = 'Invalid email';
    res.redirect('back');
  }
  else
  {
    createUser(Uname, pass, USER, email);
    req.session.success = 'User created';
    res.redirect('login');
  }
});

app.get('/admin', function(req, res){
  restrict(req, res, ADMIN, function(req,ress) { 
    res.render('admin');
  });
});
app.post('/admin', function (req, res) {
    var user = users[req.body.username];
    console.log(user);
    console.log(req.body.selectpicker);
    if(!user)
      req.session.error = ('User not found');
    else
    {
      user.access = req.body.selectpicker;
      req.session.success = user.name + " now have access = " + explain[user.access];
    }    
    res.redirect('admin');
});

app.get('/createTable', function(req, res){
  restrict(req, res, MODERATOR, function(req,ress) { 
    res.render('createTable');
  });
});

app.post('/createTable', function(req, res){
  if (req.body.stake < 0 || req.body.timeout < 11)
  {
      req.session.error = ('Stake should be > 0 and Timeout > 10');
      res.redirect('back');
  }
  
  else
  {
      createTable(req.body.tablename, req.body.stake, req.body.timeout);
      req.session.success = 'Thank you for creating table';
      res.redirect('back');
  }
});

app.get('/tables', function(req, res) {
  restrict(req, res, USER, function(req,ress) { 
    res.render('tables', {tables: tables});
  });
})

app.get('/table:id', function(req, res){
  restrict(req, res, USER, function(req,ress) { 
    if( tables[req.params.id] == null) {
      req.session.error = ('No such table');
      res.redirect('back');
    }
    else
    {
      //res.locals.tableId = req.params.id;
      //res.locals.table = tables[req.params.id];
      console.log(tables[req.params.id].stake + 'ololo');
      res.render('table',{ table: tables[req.params.id], id: req.params.id});
    }
  });
});

app.post('/table', function(req, res){
  console.log(req.body);
  var tableId = req.body.id;
  if( users[req.session.user.name].money < tables[tableId].stake){
    req.session.error = ('not enough money');
    res.redirect('back');
  }
  else
  {
    users[req.session.user.name].money -= tables[tableId].stake;
    tables[tableId].users.push(req.session.user);
    req.session.success = "You joined the table";
    res.redirect('back');
  }
  
});

app.get('/users', function(req, res){
  restrict(req, res, USER, function(req,ress) { 
     console.log(users);
    res.render('users', { users: users, explain: explain});
  });
});

app.get('/support', function(req, res){
  restrict(req, res, USER, function(req,ress) { 
    res.render('support');
  });
});

app.post('/support', function(req, res){
  if (req.body.message == '')
  {
      req.session.error = 'message should be non empty';
      res.redirect('back');
  }
  
  else
  {
      req.session.success = 'Thank you we will write you back as soon as possible';
      var out = {};
      out.username = req.session.user.name;
      out.email = req.body.email;
      out.message = req.body.message;
      support.push(out);
      res.redirect('back');
  }
});

app.get('/supportread', function(req, res){
  restrict(req, res, MODERATOR, function(req,ress) { 
    res.render('supportread', { support: support});
  });
});

if (!module.parent) {
  app.listen(process.env.PORT);
  console.log('Express started on port ' + process.env.PORT);
}
