require('dotenv').config();

const express = require('express');
const app = express();
const cors = require("cors");
const http = require('http');
const {Server} = require('socket.io');

const morgan = require('morgan');
const mongoose = require('mongoose');
const User = require('./models/userSchema')

app.use(cors());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

var OnlineList = []
var nextCode = 1000        // to generate unique convo Code

const server = http.createServer();

// Connect to Database
const URI = "mongodb+srv://"+process.env.DB_USERNAME+":"+process.env.DB_PASSWORD+"@cluster0.gajstln.mongodb.net/?retryWrites=true&w=majority"
mongoose.connect(URI)
   .then((result) => {
     console.log("Connected to DB");

     //Start listening only after databasa connection
     server.listen(process.env.PORT, () =>{
        console.log("Server Runing",process.env.PORT);
    
        // get the max ConvoID in DB to assure the uniqueness of new generated code
        User.findOne({}, {}, { sort: { 'socketID' : -1 } }, function(err, obj) {
            if (obj !== null){
                nextCode = parseInt(obj.toObject().convoCode);
            }
            console.log("Starting Convo code value: ",nextCode)
        });
      } );
   })
   .catch((error) => {console.log(error)})

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  }, 
})

//User.findByIdAndDelete()

io.on("connection", (socket) => {
  console.log("SocketID: ",socket.id," Connected");

  socket.on("init", (key) => {
    //console.log(socket.id, ": ", key)
    const user = new User({publicKey: key, socketID: socket.id, convoCode: nextCode})
    
    var isUser = false;
    User.find({publicKey: key, socketID: socket.id})
       .then(result => {
          if (result.length !==0 ){
              console.log("user already inserted into DB")
              isUser=true
          }
          if (!isUser){
            // Insert new user
            user.save()
                .then(value => {console.log(value);nextCode = nextCode + 1;})
                .catch(err => {
                console.log(err);
            });
      
            OnlineList.push(user);
            const convoCode = OnlineList.indexOf(user);
            //Send Unique convo Code to user
            io.to(socket.id).emit("initResponse",nextCode)
          }
        });
    
    

    socket.on("disconnect", () => {
      console.log("User disconnect", socket.id)
      user.remove();
      //remove from onlineList
      //
      //TODO
      //
    });
  });

  
})




/*const PORT= 8080;
app.listen(PORT);

console.log('server listening on ' + PORT);

app.use(express.static('public'));

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

app.get('/getcode', (req,res) =>{
    console.log('get code request from '+ req.ip+ " with value: "+ req.body);
    res.send("1234567");
})

app.post('/init', (req,res) => {
  console.log("POST request with value")
  const publicKey = req.body;
  console.log(publicKey)
  res.send('987654321')
})*/
