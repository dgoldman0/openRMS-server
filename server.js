// Can't get everything to run on a single port so information is on 8081 and HTTP server is on 8080
var http = require('http'),
	express = require('express'),
	app = express(),
	models = require('./models');

var loadModels = function(manifest)
{
	var fs = require("fs");
	manifest.models.forEach(function(mod) {
		console.log(mod);
		// Load each model
		if (mod.schema_file != null)
		{
			var schema;
			fs.readFile(__dirname + "/models/" + mod.schema_file, 'utf8', function(err, data) {
				if (err) throw err;
				// Compiling the schema requires actual code compilation, so require('vm') will be needed
				schema = JSON.parse(data);
				console.log(schema);
			});
		}
	});
};

var start = function()
{
	console.log("Loading config file...");
	var fs = require("fs");
	var config;
	fs.readFile(__dirname + '/conf/openrms.conf', 'utf8', function (err, data) {
		if (err) throw err;
		config = JSON.parse(data);
		if (config != null)
		{
			if (config.port == null) config.port = 8080;
			if (config.data_port == null) config.data_port = 8081;
			app.set('port', config.port);
			app.use(express.static(__dirname + '/../client'));
			console.log("Loading models...");
			var manifest;
			fs.readFile(__dirname + "/conf/models.manifest", "utf8", function(err, data) {
				if (err) throw err;
				manifest = JSON.parse(data);
				loadModels(manifest);
				console.log("Starting server...");
				var server = require('./dataserver')(app, config.data_port, models);
				app.listen(app.get('port'));
				console.log("Server running...");
			});
		}
	});
};

models['text'].find({_id : 0}, function (err, docs) {
	if (docs.length)
	{
		start();
	} else
	{
		// Configure server before starting
		console.log("Entering server configuration mode...");
		var date = new Date();
		var TextDocument = models['text'];
		var UserRole = models['user_role'];
		var Privilege = models['privilege'];
		var root = new TextDocument({links: [], content: "Welcome..."});
		root.save(function (err) {
			if (err) return console.log("Unable to create root index: " + err);
			var adminPriv = new Privilege({resources: ["*"], operations: ["*"]});
			adminPriv.save(function(err) {
				if (err) return console.log("Unable to add admin privilege " + err);
				var adminRole = new UserRole({role: "admin", privileges: [adminPriv._id]});
				adminRole.save(function(err) {
					if (err) return console.log("Unable to add admin role: " + err);
					var User = models['user'];
					var salt = require('node-uuid').v4();
					var password = require('crypto').createHash('sha512').update(salt + "password").digest("hex");
					var admin = new User({create_on: date, updated_on: date, username: "admin", password: password, salt: salt, roles: [adminRole._id]});
					admin.save(function(err) {
						if (err) return console.log("Unable to save admin: " + err);
						User.findById(admin._id, function (err, doc) {
							if (err) return console.log("Unable to find admin: " + err);
							start();
						});
					});
				});
			});
		});
	}
});
