const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )

var userSchema = mongoose.Schema({
  userId: {type: Number},
  username: { type: String, unique: true }
});

var exerciseSchema = mongoose.Schema({
  duration: { type: Number, min: 1},
  date: { type: Date, max: Date.now() },
  userId: { type: Number, required: true },
  description: { type: String, maxlength: 200 }
});

var user = mongoose.model('user', userSchema);
var exercise = mongoose.model('exercise', exerciseSchema);

app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.get('/api/exercise/log', (req, res)=>{
  console.log(req.query);
  let queryObject = {};
  if (!req.query.userId) {
    res.send('No user id sent!');
    return;
  }
  queryObject.userId = req.query.userId;
  if (req.query.from || req.query.to) {
    queryObject.date = {};
  }
  if (req.query.from) {
    queryObject.date['$gte'] = req.query.from;
  }
  if (req.query.to) {
    queryObject.date['$lte'] = req.query.to;
  } 

  let findQuery = exercise.find(queryObject);
  if (req.query.limit && Number.isInteger(parseInt(req.query.limit))) {
    findQuery.limit(parseInt(req.query.limit));
  } else if (req.query.limit) {
    res.send('Limit must be an integer');
    return;
  }

  findQuery.exec((err, docs)=>{
    if (err) {
      res.send(err)
      return;
    }
    res.json(docs.map(el=>removeHiddenFields(el._doc)));
  })
});

app.post('/api/exercise/new-user', (req, res)=>{
  user.find({}, ['userId'],
  {
    limit:1,
    sort:{
        userId: -1
    }
  }, (err, docs) => {
    let id = 1;
    if (docs.length && docs[0].userId) {
      id = docs[0].userId + 1;
    }
    req.body.userId = id;
    user.create(req.body, (err, doc)=>{
      if (err) {
        let message = 'Whoops something went wrong try again.'
        if (err.errmsg.includes('duplicate key')) {
          message = 'User name already exist, please choose a different one.'
        }
        res.send(message);
        return;
      }
      res.json(removeHiddenFields(doc._doc));
      });
    });
});

app.post('/api/exercise/add', (req, res)=>{
  exercise.create(req.body, (err, doc) => {
    if (err) {
      console.log(err)
      res.send('Whoops something went wrong, try again');
      return;
    }
    res.json(removeHiddenFields(doc._doc));
  })
});


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

function removeHiddenFields(data) {
  let dataCopy = Object.assign({}, data);
  delete dataCopy['__v'];
  delete dataCopy['_id']; 
  return dataCopy;
}

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
