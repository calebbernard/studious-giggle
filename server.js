var express = require('express');
var app = express();
var handlebars = require('express-handlebars').create({defaultLayout:'main'});
app.use(express.static(__dirname + '/public'));
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('port', '3001');
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
var session = require('express-session');

app.use(session({secret: 'calebcalebcaleb'}));
var AWS = require("aws-sdk");

AWS.config.update({
	region: "us-west-2",
	endpoint: "https://dynamodb.us-west-2.amazonaws.com"
});

var docClient = new AWS.DynamoDB.DocumentClient();
var sess;

app.get('/', function(req,res){
	sess = req.session;
	var login;
	var bird_data;
	if (sess.name){
		login = sess.name;
		var params = {
    			TableName: "Birds",
			FilterExpression: "Happyowner = :happyowner",
			ExpressionAttributeValues: {
				":happyowner":sess.name
			}
		};
		docClient.scan(params, function(err,data){
			if (err) {
				console.log(JSON.stringify(err, null, 2));
			}
			console.log(JSON.stringify(data, null, 2));
			res.render('start', {name:login, b_data: JSON.stringify(data.Items, null, 2)});
			return;
		});
		return;
	} else {
		login = "Not currently logged in";
	}
	//console.log(bird_data);
	res.render('start', {name: login});
	return;
});

app.get('/birds', function(req,res){
	sess = req.session;
	if (sess.name){
		var params = {
			TableName: "Birds",
			FilterExpression: "Happyowner = :happyowner",
			ExpressionAttributeValues: {
				":happyowner":sess.name
			}
		}
		docClient.scan(params, function(err,data){
			if (err){
				console.log(JSON.stringify(err,null,2));
			} else {
				res.send(JSON.stringify(data.Items,null,2));
				return;
			}
		});
	} else {
		res.send("Must be logged in.");
		return;
	}
});

app.put('/data', function(req,res){
	changeBird(req,res);
	return;
});

function changeBird(req,res){
	sess = req.session;
	if (sess.name){
		var params = {
			TableName:"Birds",
			FilterExpression:"Happyowner = :happyowner AND Happyname = :happyname",
			ExpressionAttributeValues: {
				":happyowner":sess.name,
				":happyname":req.body.bird
			}
		}
		docClient.scan(params, function(err,data){
			if (err){
				console.log(JSON.stringify(err, null, 2));
				res.send("Database Problem in PUT code");
				return;
			} else {
				if (data.Items[0]){
					var params = {
						TableName: "Birds",
						Key: {
							Happyname: data.Items[0].Happyname
						},
						UpdateExpression: "SET Place = :place",
						ExpressionAttributeValues: {
							":place": req.body.place
						}
					}
					docClient.update(params, function(err, data){
						if (err){
							console.log(JSON.stringify(err, null, 2));
						} else {
							res.send("Bird town updated!");
							return;
						}
					});
				} else {
					res.send("Bird not found!");
				}
			}
		});
	} else {
		res.send("You must be logged in.");
		return;
	}
}

app.delete('/data', function(req,res){
	deleteBird(req,res);
	return;
});

function deleteBird(req,res){
	sess = req.session;
	if (sess.name){
		var params = {
			TableName:"Birds",
			FilterExpression:"Happyowner = :happyowner AND Happyname = :happyname",
			ExpressionAttributeValues: {
				":happyowner":sess.name,
				":happyname":req.body.bird
			}
		}
		docClient.scan(params,function(err,data){
			if (err){
				console.log(JSON.stringify(err, null, 2));
				res.send("Database error");
				return;
			} else {
				if (data.Items[0]){
				console.log(JSON.stringify(data.Items[0].Happyname));
					var params = {
						TableName: "Birds",
						Key: {
							Happyname: data.Items[0].Happyname
						}
					}
					docClient.delete(params, function(err, data){
						if (err) {
							console.log(JSON.stringify(err,null,2));
							res.send("Delete error.");
							return;
						} else {
							console.log(JSON.stringify(data,null,2));
							res.send("Deleted!");
							return;
						}
					});
				} else {
					res.send("Bird not found!");
				}
			}
		});
	} else {
		res.send("You must be logged in.");
		return;
	}
}

app.post('/data', function(req,res){
	if (req.body.method == "DELETE"){
		deleteBird(req,res);
		return;
	}
	if (req.body.method == "PUT"){
		changeBird(req,res);
		return;
	}

	sess = req.session;
	if (sess.name){
		if (req.body.place && req.body.bird) {
			var params = {
				TableName:"Birds",
				Item: {
					"Happyowner": sess.name,
					"Place": req.body.place,
					"Happyname": req.body.bird
				}
			}
			docClient.put(params, function(err,data){
				if(err){

				} else {
					res.send("Data saved successfully!");
					return;
				}
			});
		} else {
			res.send("Attempted to add invalid data type.");
			return;
		}
	} else {
		res.send("You must be logged in.");
		return;
	}
});

app.post('/create-account', function(req,res){
	var name = req.body.name;
	var password = req.body.password;
	console.log(req.body);
	var table = "Users";
	if (!name || !password){
		res.send("bad");
		return;
	}

	var table = "Users";
	var params = {
		TableName:table,
		Item:{
			"username":name,
			"password":password
		}
	}

	docClient.put(params, function(err, data) {
   	 if (err) {
        	console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
		res.send("Account could not be created.");
		return;
    	} else {
        	console.log("Added item:", JSON.stringify(data, null, 2));
    	}
});
	res.send("Account created!");
	return;
});

app.post("/login", function(req,res){
	sess = req.session;


	if(sess.name != "" && sess.name != undefined){
		res.send("Please logout of your current account first (send GET request to /logout). currently logged in as:" + sess.name);
		return;
	}

	name = req.body.name;
	password = req.body.password;
	var params = {
		TableName: "Users",
		Key:{
			"username":name
		}
	}
	docClient.get(params, function(err,data){
		if (err){
			res.send("Error - could not read from database: " + JSON.stringify(err, null, 2));
			return;
		} else {
			if (password == data.Item.password){
				sess.name = name;
				console.log("Logged in as " + sess.name);
				res.send("Logged in successfully! logged in as: " + sess.name);
				return;
			} else {
				res.send("Wrong credentials! Please try again. db_pass: " + JSON.stringify(data, null, 2));
				return;
			}
		}
	});

});

app.get("/login", function(req,res){
	sess = req.session;
	var prev_name = sess.name;
	sess.name = "";
	console.log("logged out of " + prev_name);
	res.send("Logged out of " + prev_name + " successfully!");
	return;
});

app.get(function(req,res){
	res.status(404);
	res.render('404');
});

app.get(function(err,req,res,next){
	res.status(500);
	res.render('500');
});

app.listen(app.get('port'), function(req,res){
	console.log("Server on port " + app.get("port") + ".");
});
