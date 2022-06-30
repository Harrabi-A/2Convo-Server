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

var onlineList = []
var convoRequestList = []
var inConvoList = []
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
        User.findOne({}, {}, { sort: { 'socketID' : 1 } }, function(err, obj) {
            if (obj !== null){
                nextCode = parseInt(obj.toObject().convoCode);
                console.log("nextCode: ",nextCode)
            }
            console.log("Starting Convo code value: ",++nextCode)
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
        if (result.length === 0 ){
          // Insert new user
          user.save()
          .then(value => {nextCode++;})
          .catch(err => {
              console.log(err);
          });

      onlineList.push(user.convoCode);
      console.log("onLineList: ",onlineList)
      //Send Unique convo Code to user
      io.to(socket.id).emit("initResponse",nextCode)
        }
        });
    
    socket.on("requestConvo", (convoCode, convoRequested) => {
      if(onlineList.includes(convoRequested)){
        io.to(socket.id).emit("convoIDFound")
        // check a match request 
        console.log("the user ", convoCode, " requested a convo with existing user: ", convoRequested)  
        if (convoRequestList.includes([convoRequested.toString(), convoCode.toString()])){
          // convo request match
          console.log("convo request match")
          inConvoList.push([convoRequested, convoCode])
          convoRequestList.pop([convoRequested.toString(), convoCode.toString()])
          //
          // TODO emit to the convoer the start of convo (time stamp, convoID, ..)
          //
        } else {
          // register the request
          const convoReq = [convoCode, convoRequested]
          convoRequestList.push(convoReq)
        }
      } else {
        io.to(socket.id).emit("convoIDNotFound")
      }
      console.log("inConvoList: ", inConvoList)
      console.log("convoRequestList: ", convoRequestList)
    })
    

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
