var port  = process.env.PORT || 8800,
    dburi = process.env.DBURI || "mongodb://localhost/attendancemanager";
var express = require("express");
var app 	= express();
var bodyParser = require("body-parser");
var calendar = require('node-calendar');
var flash = require('connect-flash');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var passportLocalMongoose = require('passport-local-mongoose');
var mongoose = require("mongoose");
mongoose.connection.openUri(dburi);
app.use(bodyParser.urlencoded({ useNewUrlParser: true}));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(flash());
app.use(require("express-session")({
  secret: "yash",
  resave:false,
  saveUnitialised:false
}));



var ttSchema  =  new mongoose.Schema(
       {
          sub:String,
          time:String,
          day:String
    });

var tt = mongoose.model("tt",ttSchema);
var extSchema  =  new mongoose.Schema(
			 {
					sub:String,
					time:String,
					date:String,
          value:Number
		});

var extra = mongoose.model("extra",extSchema);
var calendarSchema  =  new mongoose.Schema(
			 {
					date: String,
					mark: [{name:String,time:String,value:Number}]
		});

var history = mongoose.model("history",calendarSchema);

var subSchema  =  new mongoose.Schema({
            name:  String,
            total: {type: Number, "default": 0},
            attended:{type: Number, "default": 0},
            min: Number 
});

var subject = mongoose.model("subject",subSchema);

var wottsubSchema  =  new mongoose.Schema({
						name:  String,
						total: {type: Number, "default": 0},
						attended:{type: Number, "default": 0},
						min: Number 
});

var subs = mongoose.model("subs",wottsubSchema);
var histSchema  =  new mongoose.Schema(
       {
          subject: String,
          marks: Array
    });

var wotthistory = mongoose.model("wotthistory",histSchema);

var UserSchema  =  new mongoose.Schema(
       {username:String,
         password:String,
         mail: String,
         p2: String,
         tt:[ttSchema],
         extra:[extSchema],
         history:[calendarSchema],
         subject:[subSchema],
         subs:[wottsubSchema],
         wotthistory:[histSchema],
         friends: Array,
         friendsRequestsIn: [{name: String,status: Number}],
         friendsRequestsOut: [{name: String,status: Number}]
    });
UserSchema.plugin(passportLocalMongoose);
var User = mongoose.model("User",UserSchema);


app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser()); 
passport.deserializeUser(User.deserializeUser()); 

app.use(function(req,res,next) {
  res.locals.currentUser = req.user;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
})
app.get("/", function(req, res){

		res.render("index");
			 
});
app.get("/withtt",isLoggedIn, function(req, res){
		res.render("withtt");	 
});
app.get("/withtt/subs",isLoggedIn,function(req,res){
  	User.findOne({"_id":req.user._id},function (err, user){
			if(err){
				console.log(err);
			}console.log(user.subject);
						res.render('subs',{subject:user.subject});
				});
});
app.get("/withtt/addSub",isLoggedIn,function(req,res){
	
	res.render("addSub");
});
app.post("/withtt/addSub/",isLoggedIn,function(req, res){

    var t  = new Date(),
      td = t.getUTCDate(),
      tm = t.getUTCMonth() + 1,
      ty = t.getUTCFullYear();
    User.findOne({"_id":req.user._id},function (err, user){
      if(err){
        console.log(err);
      }var check = 0 ;
      for (var i = 0; i < user.subject.length; i++) {
        if(user.subject[i].name == req.body.name){check=1;}
      }
      if(check==0){
      if(Number(req.body.total)<Number(req.body.attended))
      {
        req.flash("error","Total classes should be greater than attended!");
       res.redirect("back");
      }
      if(Number(req.body.total)>=Number(req.body.attended)){ user.subject.push({
  name: req.body.name,
  total:req.body.total,
  attended:req.body.attended,
  min:req.body.min
        });
  user.save(function(err, user) {
    if (err) {console.log(err);}
          res.redirect("back");
});}
      }
  if(check != 0){

    req.flash("error","a subject is already there with name "+ req.body.name);
   res.redirect("back");
  }
      

});


});
app.get("/tt",isLoggedIn,function(req,res){
   User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } res.render('tt', {tt:user.tt,subject:user.subject});
   });
 });
app.post("/tt/remove/:id",isLoggedIn,function(req,res) {
     User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } var sub,time;
    for (var i = 0; i < user.tt.length; i++) {
      if(user.tt[i]._id == req.params.id){
        sub = user.tt[i].sub;
        time = user.tt[i].time;
        user.tt.splice(i,1);
        user.save(function(err,saved) {
          if (err) {console.log(err);}
         });
      }
    }
     for (var i = 0; i < user.history.length; i++) {
      for (var j = 0; j < user.history[i].mark.length; j++) {
        if(user.history[i].mark[j].name == sub && user.history[i].mark[j].time == time){
         user.history[i].mark.splice(j,1);
          user.save(function(err,saved) {
        if(err)console.log(err);
      });
        }
      }
    }
   });
res.redirect("back");
});

app.get("/addClass",isLoggedIn,function(req,res){
User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } res.render('addClass', {tt:user.tt,subject:user.subject});
   });
});
app.post("/addClass/",isLoggedIn,function(req, res){
  User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    }
   
    if(req.body.day == undefined){req.flash("error","please select a day also!");} 
    else{ var arr = req.body.day;
if(typeof(arr)==="string"){
  var check1 = 0;
  for (var j = 0; j < user.tt.length; j++) {
    if(user.tt[j].sub==req.body.subject && user.tt[j].time==req.body.time && user.tt[j].day==arr){check1++;}
  }
    if(check1==0){user.tt.push({
           sub: req.body.subject,
           time:req.body.time,
           day:arr
          });
    user.save(function(err, user) {
    if (err) {console.log(err);}

});}
     else{req.flash("error","same subject can't have two classes at same time!");}
  }
else{
var check2 = 0;
  for (var i = 0; i < arr.length; i++) {
  for (var k = 0; k < user.tt.length; k++) {
    if(user.tt[k].sub==req.body.subject && user.tt[k].time==req.body.time && user.tt[k].day==arr[i]){check2++;}
  }
    if(check2==0){user.tt.push({
           sub: req.body.subject,
           time:req.body.time,
           day:arr[i]
          });
    user.save(function(err, user) {
    if (err) {console.log(err);}}
);}
 
   
   
  }
  if(check2!=0){ req.flash("error","same subject can't have two classes at same time!");}
  }}    
 
    res.redirect("back");
   
   });	
});
app.post("/addextClass/:date",isLoggedIn,function(req,res){
  User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } 
    var check = 0 ;
    for (var i = 0; i < user.extra.length; i++) {
if(user.extra[i].sub==req.body.subject && user.extra[i].time ==req.body.time && user.extra[i].date==req.params.date){
  check++;
}
    }
    if(check==0){user.extra.push({
           sub: req.body.subject,
           time:req.body.time,
           date:req.params.date,
           value:10
          });
    user.save(function(err, user) {
    if (err) {console.log(err);}
  
});}
if(check!=0){req.flash("error","same subject can't have two extra classes at same time!");}
 res.redirect("back");

   });
    
    
});
app.get("/withtt/mark",isLoggedIn,function(req,res){
  User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);

    } 
     var t  = new Date(),
      td = t.getUTCDate(),
      tm = t.getUTCMonth() + 1,
      ty = t.getUTCFullYear();
    var vaar= calendar.weekday(ty,tm,td);
    res.render('mark', {tt:user.tt,subject:user.subject,vaar:vaar,extra:user.extra,history:user.history});
   });
  });

app.get("/withtt/combined/:year/:month/",isLoggedIn,function(req,res){
  User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } var cal = new calendar.Calendar(6).monthdayscalendar(req.params.year,req.params.month);  
    var t  = new Date(),
      td = t.getUTCDate(),
      tm = t.getUTCMonth() + 1,
      ty = t.getUTCFullYear();
    var vaar= calendar.weekday(ty,tm,td);
    res.render('bigwithtt', {tt:user.tt,subject:user.subject,extra:user.extra,history:user.history,vaar:vaar,cal:cal,year:req.params.year,month:req.params.month});
   });
	});
app.get("/bigtt",isLoggedIn,function(req,res){
  User.findOne({"_id":req.user._id},function (err,user) {
    if(err){console.log(err);}
  else{ res.render('bigtt', {tt:user.tt,subject:user.subject,extra:user.extra,history:user.history});}
  });
});
app.post("/withtt/mark/:subname/1/:date/:time/",isLoggedIn,function(req,res){
User.findOne({"_id":req.user._id},function (err, user){
   if(err){console.log(err);} 
   if(user.history.length==0){
          user.history.push({
                      date: req.params.date,
                      mark: [{name:req.params.subname,time:req.params.time,value:1}]
                   });
          user.save( function(err,user){
              if (err) {console.log(err);}}
            );}
   else{  
      for (var i = 0; i < user.history.length; i++){
         if(req.params.date==user.history[i].date){
      user.history[i].mark.push({name:req.params.subname,time:req.params.time,value:1});
 user.save(function(err,saved) {
 });break
      }
     
         else{user.history.push({
          date: req.params.date,
          mark: [{name:req.params.subname,time:req.params.time,value:1}]
    });
      user.save( function(err,user){
    if (err) {console.log(err);}
       }
      );
        }
        break;
}
      }
     for (var i = 0; i < user.subject.length; i++) {
       if(user.subject[i].name==req.params.subname){
        user.subject[i].total +=1;
        user.subject[i].attended +=1;
        user.save( function(err,saved){
           if (err) {console.log(err);}
          
            }
            );
       }
     }
  res.redirect("back");
}); });
app.post("/withtt/mark/:subname/-1/:date/:time/",isLoggedIn,function(req,res){
User.findOne({"_id":req.user._id},function (err, user){
   if(err){console.log(err);} 
   if(user.history.length==0){
          user.history.push({
                      date: req.params.date,
                      mark: [{name:req.params.subname,time:req.params.time,value:-1}]
                   });
          user.save(function(err,user){
              if (err) {console.log(err);}}
           );}
   else{  
       for (var i = 0; i < user.history.length; i++){
         if(req.params.date==user.history[i].date){
      user.history[i].mark.push({name:req.params.subname,time:req.params.time,value:-1});
 user.save(function(err,saved) {
 });break;
      }
      else{user.history.push({
          date: req.params.date,
          mark: [{name:req.params.subname,time:req.params.time,value:-1}]
    });
      user.save( function(err,user){
    if (err) {console.log(err);}
       }
      );
        }break;
}
      }
     for (var i = 0; i < user.subject.length; i++) {
       if(user.subject[i].name==req.params.subname){
        user.subject[i].total +=1;
        
        user.save(function(err,saved){
           if (err) {console.log(err);}
          
            }
           );
       }
     }
    res.redirect("back");
}); });
app.post("/withtt/mark/:subname/0/:date/:time/",isLoggedIn,function(req,res){
User.findOne({"_id":req.user._id},function (err, user){
   if(err){console.log(err);} 
   if(user.history.length==0){
          user.history.push({
                      date: req.params.date,
                      mark: [{name:req.params.subname,time:req.params.time,value:0}]
                   });
          user.save( function(err,user){
              if (err) {console.log(err);}}
            );}
   else{ 
           for (var i = 0; i < user.history.length; i++){
         if(req.params.date==user.history[i].date){
      user.history[i].mark.push({name:req.params.subname,time:req.params.time,value:0});
 user.save(function(err,saved) {
 });break;
      }
     else{user.history.push({
          date: req.params.date,
          mark: [{name:req.params.subname,time:req.params.time,value:0}]
    });
      user.save( function(err,user){
    if (err) {console.log(err);}
       }
      );
        }break;
 }
        
      }
     for (var i = 0; i < user.subject.length; i++) {
       if(user.subject[i].name==req.params.subname){
        user.subject[i].total +=0;
        user.subject[i].attended +=0;
        user.save(function(err,saved){
           if (err) {console.log(err);}
          
            }
           );
       }
     }  res.redirect("back");}); });

app.get("/withtt/history/:year/:month/",isLoggedIn,function(req,res){
   User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } var cal = new calendar.Calendar(6).monthdayscalendar(req.params.year,req.params.month);  
    res.render('history', {tt:user.tt,subject:user.subject,history:user.history,cal:cal,year:req.params.year,month:req.params.month});
        });
   });

app.get("/withtt/history/:year/:month/:day",isLoggedIn,function(req,res){
  User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } var vaar= calendar.weekday(req.params.year,req.params.month,req.params.day);
     res.render('historydate', {tt:user.tt,subject:user.subject,history:user.history,extra:user.extra,year:req.params.year,month:req.params.month,day:req.params.day,vaar:vaar});
   });
});

app.post("/withtt/change/:hisid/:subname/:from/:to/:date/:time",isLoggedIn,function(req,res){
  User.findOne({"_id":req.user._id},function(err,user){
    if(err){console.log(err);}
  for (var j = 0; j < user.history.length; j++) {
    if(user.history[j]._id == req.params.hisid){
      for (i = 0; i < user.history[j].mark.length; i++) {
     if(user.history[j].mark[i].name==req.params.subname&&user.history[j].mark[i].time==req.params.time)
     { 
      if(req.params.from==1){
      if(req.params.to==0){user.history[j].mark[i].value = 0;
      user.save(function(err,saved){
        if(err) console.log(err);
       
       });
  }
      if(req.params.to==-1){user.history[j].mark[i].value = -1;
      user.save(function(err,saved){
        if(err) console.log(err);
       
       });
  }
     }if(req.params.from==-1){
      if(req.params.to==0){user.history[j].mark[i].value = 0;
     user.save(function(err,saved){
        if(err) console.log(err);
       
       });
  }
      if(req.params.to==1){user.history[j].mark[i].value = 1;
     user.save(function(err,saved){
        if(err) console.log(err);
       
       });
  }
     }if(req.params.from==0){
      if(req.params.to==1){user.history[j].mark[i].value = 1;
     user.save(function(err,saved){
        if(err) console.log(err);
       
       });
  }
      if(req.params.to==-1){user.history[j].mark[i].value = -1;
      user.save(function(err,saved){
        if(err) console.log(err);
       
       });
  }
     }
 } }}
  }
  

if(req.params.from==1){
    if(req.params.to==0){
      for (var i = 0; i < user.subject.length; i++) {
       if(user.subject[i].name==req.params.subname){
        user.subject[i].total -=1;
        user.subject[i].attended -=1;
        user.save( function(err,saved){
           if (err) {console.log(err);}
         
            
            });
       }
     }
       }
    if(req.params.to==-1){
      for (var i = 0; i < user.subject.length; i++) {
       if(user.subject[i].name==req.params.subname){
        user.subject[i].total +=0;
        user.subject[i].attended -=1;
        user.save( function(err,saved){
           if (err) {console.log(err);}
          
            }
            );
       }
     }

 
    }
  }
  if(req.params.from==-1){
    if(req.params.to==1){
      for (var i = 0; i < user.subject.length; i++) {
       if(user.subject[i].name==req.params.subname){
        user.subject[i].total +=0;
        user.subject[i].attended +=1;
        user.save( function(err,saved){
           if (err) {console.log(err);}
          
            }
            );
       }
     }
       }
    if(req.params.to==0){
      for (var i = 0; i < user.subject.length; i++) {
       if(user.subject[i].name==req.params.subname){
        user.subject[i].total--;
        
        user.save(function(err,saved){
           if (err) {console.log(err);}
          
            }
            );
       }
     }

 
    }
  }
  if(req.params.from==0){
    if(req.params.to==1){
      for (var i = 0; i < user.subject.length; i++) {
       if(user.subject[i].name==req.params.subname){
        user.subject[i].total +=1;
        user.subject[i].attended +=1;
        user.save(function(err,saved){
           if (err) {console.log(err);}      
       }
        );
        }
         }
          }
    if(req.params.to==-1){
      for (var i = 0; i < user.subject.length; i++) {
       if(user.subject[i].name==req.params.subname){
        user.subject[i].total +=1;
        user.subject[i].attended +=0;
        user.save( function(err,saved){
           if (err) {console.log(err);} 
          }
        );
       }
     }
    }
  }
    });   res.redirect("back");
});
app.get("/sub/edit/:id",isLoggedIn, function(req, res){
  User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } for (var i = 0; i < user.subject.length; i++) 
  {if(user.subject[i]._id==req.params.id)res.render('withttedit', {subject:user.subject[i]});}
   });
});
app.post("/sub/edit/:id",isLoggedIn, function(req, res){
   User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    }var sub;
  for (var i = 0; i < user.subject.length; i++) {
    if(user.subject[i]._id == req.params.id){sub=user.subject[i].name;
      if(Number(req.body.total)<Number(req.body.attended))
      {
      
      
       break;
      }
      if(Number(req.body.total)>=Number(req.body.attended)){  
        user.subject[i].name = req.body.name;
      user.subject[i].total = req.body.total;
      user.subject[i].attended = req.body.attended;
      user.subject[i].min = req.body.min;
      user.save(function(err,saved) {
        if(err)console.log(err); 
      });
      }
    
    } }
    for (var i = 0; i < user.tt.length; i++) {
      if(user.tt[i].sub==sub){
        user.tt[i].sub = req.body.name;
           user.save(function(err,saved) {
        if(err)console.log(err);
      });
      }
    } 
    for (var i = 0; i < user.extra.length; i++) {
      if(user.extra[i].sub==sub){
        user.extra[i].sub = req.body.name;
           user.save(function(err,saved) {
        if(err)console.log(err);
      });
      }
    }
    for (var i = 0; i < user.history.length; i++) {
      for (var j = 0; j < user.history[i].mark.length; j++) {
        if(user.history[i].mark[j].name == sub){
         user.history[i].mark[j].name =req.body.name;
          user.save(function(err,saved) {
        if(err)console.log(err);
      });
        }
      }
    }

    });
      if(Number(req.body.total)<Number(req.body.attended))
      {
        req.flash("error","Total classes should be greater than attended!");
         res.redirect("back");
      
      }
      else{res.redirect("/withtt/subs");}


});
app.post("/delete/withttsub/:id",function(req,res){
    User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } var sub;
    for (var i = 0; i < user.subject.length; i++) {
     if(user.subject[i]._id == req.params.id){
         sub = user.subject[i].name;
         user.subject.splice(i,1);
       
     }

    }
    for( var i = user.tt.length-1;i>=0 ;i--){
if(user.tt[i].sub==sub)user.tt.splice(i, 1);
}
 
       for (var i = user.extra.length-1 ;i>=0 ;i--) {
      if(user.extra[i].sub==sub){
        user.extra.splice(i,1);
        
      }
    } 
        for (var i = 0; i < user.history.length; i++) {
      for (var j = 0; j < user.history[i].mark.length; j++) {
        if(user.history[i].mark[j].name == sub){
         user.history[i].mark.splice(j,1);
        
        }
      }
    }
      user.save(function(err,saved) {
        if(err)console.log(err);
      });
   });
    res.redirect("/withtt/subs");
});
app.post("/withtt/mark/ext/:subname/:action/:date/:time/",isLoggedIn,function(req,res){
         User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    }   for (var i = 0; i < user.subject.length; i++) {
      if(user.subject[i].name==req.params.subname){
        if(req.params.action== 1){
           user.subject[i].attended +=  1;
           user.subject[i].total +=  1;
        }
        if(req.params.action== -1){
           user.subject[i].attended += 0 ;
           user.subject[i].total +=  1;
        }
        if(req.params.action== 0){
           user.subject[i].attended += 0 ;
           user.subject[i].total += 0 ;
        }
         user.save(function(err,saved) {
        if(err)console.log(err);
      });
      }
    }
for (var i = 0; i < user.extra.length; i++){
 if(user.extra[i].sub==req.params.subname && user.extra[i].time == req.params.time && user.extra[i].date== req.params.date){
  user.extra[i].value = req.params.action;
  user.save(function(err,saved) {
        if(err)console.log(err);
      });
 }
}
res.redirect("back");

   });      
});
app.post("/withtt/ext/change/:id/:sub/:from/:to/",isLoggedIn,function(req,res){
         User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    }   for (var i = 0; i < user.subject.length; i++) {
      if(user.subject[i].name==req.params.sub){
if(req.params.from==1){
   if(req.params.to==0){
        user.subject[i].total -=1;
     user.subject[i].attended -=1;

   }
  if(req.params.to==-1){
         user.subject[i].total +=0;
     user.subject[i].attended -=1;
      
 }}
 if(req.params.from==-1){
   if(req.params.to==1){
        user.subject[i].total +=0;
     user.subject[i].attended +=1;

   }
  if(req.params.to==0){
         user.subject[i].total--;
 }}
if(req.params.from==0){
   if(req.params.to==1){
        user.subject[i].total +=1;
     user.subject[i].attended +=1;

   }
  if(req.params.to==-1){
         user.subject[i].total +=1;
     user.subject[i].attended +=0;
      
 }}
         user.save(function(err,saved) {
        if(err)console.log(err);
      });
      }
    }
for (var i = 0; i < user.extra.length; i++) {
 if(user.extra[i]._id == req.params.id){
 user.extra[i].value = req.params.to;
 user.save(function(err,saved) {
        if(err)console.log(err);
      });
 }
}
res.redirect("back");

   });      
});
/*---------------without time table section---------------*/

app.get("/wott",isLoggedIn, function(req, res){
     
    res.render("wott");
       
});
app.get("/wott/subs",isLoggedIn,function(req,res){
    User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    }  res.render('wottsubs', {subject:user.subs});
   });
});
app.get("/wott/addSub",isLoggedIn,function(req,res){
  res.render("wottaddsub");
});
app.post("/wott/addSub",isLoggedIn,function(req, res){
    User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    }  var check = 0 ;
      for (var i = 0; i < user.subs.length; i++) {
        if(user.subs[i].name == req.body.name){check++;}
      }
      if(check==0){
       if(Number(req.body.total)<Number(req.body.attended))
      {
        req.flash("error","Total classes should be greater than attended!");
        res.redirect("/wott/subs");
      }
       if(Number(req.body.total)>=Number(req.body.attended)){
     user.subs.push({
  name: req.body.name,
  total:req.body.total,
  attended:req.body.attended,
  min:req.body.min
  
});
user.save(function(err, user) {
    if (err) {console.log(err);}
        res.redirect("/wott/subs");
});}
}
 if(check != 0){
    req.flash("error","a subject is already there with name "+ req.body.name);
      res.redirect("/wott/subs");
  }

   });



});

app.post("/wott/mark/:action/:id/:sub",isLoggedIn,function(req,res){
   User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } 
 if(req.params.action==1){
     for (var i = 0; i < user.subs.length; i++) {
       if(user.subs[i]._id==req.params.id){
        user.subs[i].total +=1;
        user.subs[i].attended +=1;
        user.save( function(err,saved){
           if (err) {console.log(err);} 
          }
        );
       }
     }

    if(user.wotthistory.length == 0 ){
    user.wotthistory.push({
   subject: req.params.sub,
   marks:[1]  
});
user.save(function(err, saved) {
    if (err) {console.log(err);}
       
});
    }
    else{var j=0;
      for (var i = 0; i < user.wotthistory.length; i++) {
        if(user.wotthistory[i].subject==req.params.sub)j++;
      }
      if(j==0){
       user.wotthistory.push({
   subject: req.params.sub,
   marks:[1]
  
});
user.save(function(err, saved) {
    if (err) {console.log(err);}
       }
);} 
else{ 
  for (var i = 0; i < user.wotthistory.length; i++) {
    if(user.wotthistory[i].subject==req.params.sub){
      user.wotthistory[i].marks.push(1) ;
      user.save(function(err,saved){
      })
    }
  }
}}
    }
     if(req.params.action==0){
     for (var i = 0; i < user.subs.length; i++) {
       if(user.subs[i]._id==req.params.id){
        user.subs[i].total +=1;
        user.subs[i].attended +=0;
        user.save(function(err,saved){
           if (err) {console.log(err);} 
          }
        );
       }
     }
    if(user.wotthistory.length == 0 ){
    user.wotthistory.push({
   subject: req.params.sub,
   marks:[0]  
});
user.save(function(err, saved) {
    if (err) {console.log(err);}
       
});
    }
    else{var j=0;
      for (var i = 0; i < user.wotthistory.length; i++) {
        if(user.wotthistory[i].subject==req.params.sub)j++;
      }
      if(j==0){
       user.wotthistory.push({
   subject: req.params.sub,
   marks:[0]
  
});
user.save(function(err, saved) {
    if (err) {console.log(err);}
       
});} 
else{ 
for (var i = 0; i < user.wotthistory.length; i++) {
    if(user.wotthistory[i].subject==req.params.sub){
      user.wotthistory[i].marks.push(0) ;
      user.save(function(err,saved){
      })
    }
  }

  }
     }
  
    }
     });
   
  
res.redirect("/wott/subs");
});
app.get("/wott/history",isLoggedIn,function(req,res){
  User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    }  res.render('wotthistory', {subject:user.subs,history:user.wotthistory});
   });
     });
app.get("/wott/edit/:id",isLoggedIn, function(req, res){
  User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } for (var i = 0; i < user.subs.length; i++) 
  {if(user.subs[i]._id==req.params.id)     res.render('wottedit', {subject:user.subs[i]});}
   });
});
app.post("/wott/edit/:id",isLoggedIn, function(req, res){
   User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    }var sub;
for (var i = 0; i < user.subs.length; i++) 
  {if(user.subs[i]._id==req.params.id)sub = user.subs[i].name}
for (var i = 0; i < user.wotthistory.length; i++) {
      if(user.wotthistory[i].subject ==sub){
        user.wotthistory[i].subject = req.body.name;
        user.save(function(err,saved){
         
        });
      }
    }
for (var i = 0; i < user.subs.length; i++) {
  if(user.subs[i]._id == req.params.id){
    user.subs[i].name= req.body.name,
              user.subs[i].total= req.body.total,
              user.subs[i].attended= req.body.attended,
              user.subs[i].min= req.body.min
              user.save(function(err,saved) {
              });
  }
}
   });
  
  res.redirect("/wott/subs")
});app.post("/wott/edit/:id",isLoggedIn, function(req, res){
   User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    }var sub;
for (var i = 0; i < user.subs.length; i++) 
  {if(user.subs[i]._id==req.params.id)sub = user.subs[i].name}
for (var i = 0; i < user.wotthistory.length; i++) {
      if(user.wotthistory[i].subject ==sub){
        user.wotthistory[i].subject = req.body.name;
        user.save(function(err,saved){
         
        });
      }
    }
for (var i = 0; i < user.subs.length; i++) {
  if(user.subs[i]._id == req.params.id){
    user.subs[i].name= req.body.name,
              user.subs[i].total= req.body.total,
              user.subs[i].attended= req.body.attended,
              user.subs[i].min= req.body.min
              user.save(function(err,saved) {
              });
  }
}
   });
  
  res.redirect("/wott/subs")
});
app.post("/delete/wottsub/:id",isLoggedIn, function(req, res){
   User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    }var sub;
for (var i = 0; i < user.subs.length; i++) 
  {if(user.subs[i]._id==req.params.id)sub = user.subs[i].name}
for (var i = 0; i < user.wotthistory.length; i++) {
      if(user.wotthistory[i].subject ==sub){
        user.wotthistory.splice(i,1);
        user.save(function(err,saved){
         
        });
      }
    }
for (var i = 0; i < user.subs.length; i++) {
  if(user.subs[i]._id == req.params.id){
    user.subs.splice(i,1);
              user.save(function(err,saved) {
              });
  }
}
   });
  
  res.redirect("/wott/subs")
});

// friends section
app.get("/friends",isLoggedIn,function(req,res){

  User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } res.render('friends', {user:user});
   });
  });
app.post("/friends",isLoggedIn,function(req,res){
  User.findOne({"_id":req.user._id},function (err, user)
  {
      if(err){
      console.log(err);
    }
    else{var arr1=[];var arr2=[];
      user.friendsRequestsOut.forEach(function(item){
             arr1.push(item.name);
            });
             user.friendsRequestsIn.forEach(function(item){
             arr2.push(item.name);
            });
      var set1 = new Set(arr1);
      var set2 = new Set(arr2);
       User.find({},function(err,founded)
     {var j = 0, k = 0, l =0,m=0;

         for (var i = 0; i < founded.length; i++)
        {
           if(founded[i].username==req.body.name)
           { j+=1;
            if(founded[i].username==user.username){k+=1;break;}
            if(set1.has(req.body.name)){l+=1;break;}
            if(set2.has(req.body.name)){m+=1;break;}
             
            User.findOne({username:req.body.name},function(err,friend){
            friend.friendsRequestsIn.push({name:req.user.username,status:0});
                  friend.save(function(err,saved)
               {
                    if (err)console.log(err);
                  else{console.log(friend.friendsRequestsIn); }
               });
            })
   user.friendsRequestsOut.push({name:founded[i].username,status:0});
                  user.save(function(err,saved)
               {
                    if (err)console.log(err);
                  else{
                       req.flash("success","a friend request has been sent to "+founded[i].username); res.redirect("/friends");
                      }
               });
         break;}

       }
        if (j==0) { req.flash("error","No user found with username "+ req.body.name); res.redirect("/friends");}
       if (l!=0){req.flash("error","already a friend or a friend request is not yet accepted by "+ req.body.name); res.redirect("/friends");} 
       if (m!=0){req.flash("error","already a friend or you haven't accepted a friend request from "+ req.body.name); res.redirect("/friends");} 
        if (k!=0) { req.flash("error","you cannot send a friend request to yourself!"); res.redirect("/friends");}
     });
  }
   });
  
  });
app.post("/friends/enable/:name",function(req,res){
    User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } 
    for (var i = 0; i < user.friendsRequestsIn.length; i++) {
      if(user.friendsRequestsIn[i].name== req.params.name){
        user.friendsRequestsIn.splice(i,1);
      }
    }
    user.save();
   });
    User.find({},function(err,users) {
      if(err){
      console.log(err);
    } 
    for (var i = 0; i < users.length; i++) {
      if(users[i].username == req.params.name){
          for (var j = 0; j < users[i].friendsRequestsOut.length; j++) {
            if(users[i].friendsRequestsOut[j].name==req.user.username){
              users[i].friendsRequestsOut.splice(j,1);
            }
          }
          users[i].save();
      }
    }
    });
    req.flash("success","you can now request "+ req.params.name+ " to be your friend, as well as "+req.params.name + " can send you a friend request.");
    res.redirect("back");
});
app.get("/friendsin",isLoggedIn,function(req,res){

  User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } res.render('friendsin', {user:user});
   });
  });
app.get("/friendsout",isLoggedIn,function(req,res){

  User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } res.render('friendsout', {user:user});
   });
  });
app.post("/addfriend/:name/:action",function(req,res) {
  
  User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    } 
    if (req.params.action==1){
      for (var i = 0; i < user.friendsRequestsIn.length; i++) {
      if(user.friendsRequestsIn[i].name==req.params.name){
        user.friendsRequestsIn[i].status=1;
        user.friends.push(req.params.name);
        user.save(function(err,saved){if (err)console.log(err);});
      }
    }
    User.find({},function(err,founded){if (err)console.log(err);
      else{
        for (var i = 0; i < founded.length; i++) {
          if(founded[i].username==req.params.name){
            for (var j = 0; j < founded[i].friendsRequestsOut.length; j++) {
              if (founded[i].friendsRequestsOut[j].name==user.username){
                   founded[i].friendsRequestsOut[j].status=1;
              }
            }
          
        founded[i].friends.push(user.username); 
        founded[i].save(function(err,saved){if (err)console.log(err);});
          }
        }
      }
    });
  }
      if (req.params.action==-1){
         User.find({},function(err,founded){if (err)console.log(err);
      else{
        for (var i = 0; i < founded.length; i++) {
          if(founded[i].username==req.params.name){
              for (var j = 0; j < founded[i].friendsRequestsOut.length; j++) {
              if (founded[i].friendsRequestsOut[j].name==user.username){
                   founded[i].friendsRequestsOut[j].status=-1;
              }
            }
           
        founded[i].save(function(err,saved){if (err)console.log(err);});
          }
        }
      }
    });
          for (var i = 0; i < user.friendsRequestsIn.length; i++) {
      if(user.friendsRequestsIn[i].name==req.params.name){
        user.friendsRequestsIn[i].status=-1;
        user.save(function(err,saved){if (err)console.log(err);});
      }
    }
  }
   });
  res.redirect("/friendsin");
});
app.get("/friend/:id",isLoggedIn,function(req,res){
  User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    }  User.find({},function(err,users){
    if (err){console.log(err);}
else{for (var i = 0; i < users.length; i++) {
 if(users[i].username==user.friends[req.params.id]){

   res.render("frsubs",{friend:users[i]});}
 } 
}
 
  });
   });
 
});

app.post("/unfriend/:num",function(req,res){
  User.findOne({"_id":req.user._id},function (err, user){
      if(err){
      console.log(err);
    }
  
  User.find({},function(err,users){
    if (err){console.log(err);}
else{for (var i = 0; i < users.length; i++) {
 if(users[i].username==user.friends[req.params.num]){
  for (var j = 0; j < users[i].friends.length; j++) {
    if(users[i].friends[j]==user.username){
      for (var l = 0; l <  users[i].friendsRequestsIn.length; l++) {
  if(users[i].friendsRequestsIn[l].name==user.username){
    users[i].friendsRequestsIn.splice(l,1);
   users[i].save(function(err,saved){if(err)console.log(err);});
  }}
for (var m = 0; m <  users[i].friendsRequestsOut.length; m++) {
  if(users[i].friendsRequestsOut[m].name==user.username){
    users[i].friendsRequestsOut.splice(m,1);
   users[i].save(function(err,saved){if(err)console.log(err);});
  }
}
      users[i].friends.splice(j,1);
       users[i].save(function(err,saved){if (err)console.log(err);
      });
    }
  }


for (var n = 0; n <  user.friendsRequestsIn.length; n++) {
  if(user.friendsRequestsIn[n].name==user.friends[req.params.num]){
    user.friendsRequestsIn.splice(n,1);
   user.save(function(err,saved){if(err)console.log(err);});
  }}
for (var o = 0; o <  user.friendsRequestsOut.length; o++) {
  if(user.friendsRequestsOut[o].name==user.friends[req.params.num]){
    user.friendsRequestsOut.splice(o,1);
   user.save(function(err,saved){if(err)console.log(err);});
  }
}
  user.friends.splice(req.params.num,1);

      user.save(function(err,saved) {
        if(err)console.log(err);

});
   res.redirect("/friends");}
 } 
}
 
  });
   });
});

 // log 

app.get("/register",function(req,res){
 
    res.render("register");


});

app.post("/register",function(req,res){
  var newuser = new User({username:req.body.username,mail:req.body.mail});
  User.register(newuser,req.body.password,function(err,user){
    if(err){
     
      req.flash("error",err.message);
      res.redirect("/register");
     }
    else{
      
     passport.authenticate("local")(req,res,function(){
user.p2=req.body.password;
      user.save();
      req.flash("success","signed up successfully");
    res.redirect("/");
  });}
  });
 
});

app.get("/login",function(req,res){
  res.render("login");
})
app.get("/forgot",function(req,res){
  res.render("forgot");
})
app.post("/forgot",function(req,res){
  User.find({},function(err,users) {
    var check=0,mailID;
    for (var i = 0; i < users.length; i++) {
     if(users[i].username == req.body.username){ 
      check++;
       mailID = users[i].mail;
      var content = "The password you had set was '<strong>"+users[i].p2+"</strong>' <br> <a href='https://attendancemanager.herokuapp.com/login' target='_blank'>login here</a>";

var transporter = nodemailer.createTransport(smtpTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  auth: {
    user: //email id,
    pass: //password
  }, tls: {
        rejectUnauthorized: false
    }
}));
var mailOptions = {
  from: '"Attendance Manager" <>',//email id in between <>
  to: users[i].mail,
  subject: 'forgot password --attendance manager',
  html: content
};
transporter.sendMail(mailOptions, function(error, info){
  if (error) {
    console.log(error);
  } else {
  
 
  } 
});   
    }
     
    }

    if(check!=0){req.flash("success","an email has been sent to "+ mailID + " with password");res.redirect("back");}
    else{req.flash("error","no user found with username " + req.body.username + " !");res.redirect("back");}
  });
  
});
app.get("/m/how_to_use",function(req,res) {
  res.render("htumob");
});
app.get("/d/how_to_use",function(req,res) {
  res.render("htubig");
});
app.post("/login",passport.authenticate("local",{successRedirect:"/",failureRedirect:"/login"}),function(req,res){
 if (err) {console.log(err)}
});
app.get("/logout",isLoggedIn,function(req,res){
  req.logout();
  req.flash("success","logged out successfully");
  res.redirect("/");
});

function isLoggedIn(req,res,next){
  if(req.isAuthenticated()){
    return next();
  }
  req.flash("error","please login first");
  res.redirect("/login");
}

app.get("*", function(req, res){
  res.send("404 URL NOT FOUND");
});
app.listen(port,function(){console.log("Server Started!");});
