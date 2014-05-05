/**
 * Module dependencies.
 */

var express = require('express');
var hash = require('./pass').hash;
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var url = require("url");	

var app = module.exports = express();

// config

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// middleware

app.use(bodyParser());
app.use(cookieParser('shhhh, very secret'));
app.use(session());

// Session-persisted message middleware

app.use(function(req, res, next){
  var err = req.session.error;
  var msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
  if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
  next();
});

// dummy database

var users = {};

// when you create a user, generate a salt
// and hash the password ('foobar' is the pass here)


function createUser(Uname, pass)
{
  users[Uname] = {name: Uname };
  hash(pass, function(err, salt, hash){
    if (err) throw err;
    // store the salt & hash in the "db"
    users[Uname].salt = salt;
    users[Uname].hash = hash;
    users[Uname].money = 100;
  });    
}

createUser('test','test');

// Authenticate using our plain-object database of doom!

function authenticate(name, pass, fn) {
  if (!module.parent) console.log('authenticating %s:%s', name, pass);
  var user = users[name];
  // query the db for the given username
  if (!user) return fn(new Error('cannot find user'));
  // apply the same algorithm to the POSTed password, applying
  // the hash against the pass / salt, if there is a match we
  // found the user
  hash(pass, user.salt, function(err, hash){
    if (err) return fn(err);
    if (hash == user.hash) return fn(null, user);
    fn(new Error('invalid password'));
  });
}

function restrict(req, res, next) {
  if (req.session.user) {
    next();
    res.send(req.session.user.name + " $= " + req.session.user.money);
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

app.get('/', function(req, res){
  res.redirect('login');
});

app.get('/restricted', restrict, function(req, res){
  //res.send('Wahoo! restricted area, click to <a href="/logout">logout</a>');
});

app.get('/logout', function(req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function(){
    res.redirect('/');
  });
});

app.get('/login', function(req, res){
  res.render('login');
});

app.post('/login', function(req, res){
  //for DEBUG
  req.body.username = 'test';
  req.body.password = 'test';
  authenticate(req.body.username, req.body.password, function(err, user){
    if (user) {
      // Regenerate session when signing in
      // to prevent fixation
      req.session.regenerate(function(){
        // Store the user's primary key
        // in the session store to be retrieved,
        // or in this case the entire user object
        req.session.user = user;
        req.session.success = 'Authenticated as ' + user.name
          + ' click to <a href="/logout">logout</a>. '
          + ' You may now access <a href="/restricted">/restricted</a>.';
        res.redirect('back');
      });
    } else {
      req.session.error = 'Authentication failed, please check your '
        + ' username and password.'
        + ' (use "tj" and "foobar")';
      res.redirect('login');
    }
  });
});

app.get('/register', function(req, res){
  res.render('register');
});
app.post('/register', function(req, res){
  Uname = req.body.username;
  pass = req.body.password;
  createUser(Uname, pass);
  if (!module.parent) console.log('testing %s:%s', Uname, pass);
  res.send('User ' + Uname + ' password ' + pass);
});

app.get('/createTable', function(req, res){
  res.render('createTable');
}); 
app.post('/createTable', function(req, res){
  // Store the user's primary key
  // in the session store to be retrieved,
  // or in this case the entire user object
  req.session.success = 'User ' + req.session.user.name + 'Try create table with stake' + req.body.stake;
  res.redirect('back');
});

app.get('/table', function(req, res){
  res.render('table');
}); 
app.post('/table', function(req, res){
  // Store the user's primary key
  // in the session store to be retrieved,
  // or in this case the entire user object
  req.session.success = 'User ' + req.session.user.name + 'Try to join' + JSON.stringify(queryAsObject);
  res.redirect('back');
});

if (!module.parent) {
  app.listen(process.env.PORT);
  console.log('Express started on port ' + process.env.PORT);
}
