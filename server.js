// incluye módulo express
var express = require("express");

// crear instancia de express
var app = express();

// usa middleware express - formidable
var formidable = require("express-formidable");
app.use(formidable());

// incluir módulo mongodb
var mongodb = require("mongodb");

// obtener el cliente mongodb
var mongoClient = mongodb.MongoClient;

// obtener ObjectId, es único para cada documento
var ObjectId = mongodb.ObjectId;

// crea un servidor http a partir de una instancia express
var http = require("http").createServer(app);

// incluye el módulo bcrypt
var bcrypt = require("bcrypt");

// fs
var fileSystem = require("fs");

// incluye el módulo jsonwebtoken
var jwt = require("jsonwebtoken");

// cadena secreta aleatoria
var accessTokenSecret = "myAccessTokenSecret1234567890";

// use la carpeta pública para archivos css y js
app.use("/public", express.static(__dirname + "/public"));

// usa el motor ejs para renderizar archivos html
app.set("view engine", "ejs");

// socket
var socketIO = require("socket.io")(http);
var socketID = "";
var users = [];

var mainURL = "http://localhost:3000";

socketIO.on("connection", function (socket) {
    console.log("Usuario conectado", socket.id);
    socketID = socket.id;
});

/*******************************/
// inicia el servidor en el puerto 3000
/*******************************/
http.listen(3000, function () {
    console.log("Servidor iniciado.");

    // conectarse con mongo atlas
    mongoClient.connect("mongodb+srv://alex:proyectobd3@cluster0.apfbj.mongodb.net/my_social_network", function (error, client) {


        // el nombre de la base de datos será "my_social_network"
        var database = client.db("my_social_network");
        console.log("Base de datos conectada!");

        // ruta para las solicitudes de registro
        // obtener acceso a la solicitud desde el navegador
        app.get("/signup", function (request, result) {
            // renderizar el archivo signup.ejs dentro de la carpeta "vistas"
            result.render("signup");
        });

        /*******************************/
        /* Registrarse */
        /*******************************/
        app.post("/signup", function (request, result) {
            var name = request.fields.name;
            var username = request.fields.username;
            var email = request.fields.email;
            var password = request.fields.password;
            var gender = request.fields.gender;

            database.collection("users").findOne({
                $or: [{
                    "email": email
                }, {
                    "username": username
                }]
            }, function (error, user) {
                if (user == null) {
                    bcrypt.hash(password, 10, function (error, hash) {
                        database.collection("users").insertOne({
                            "name": name,
                            "username": username,
                            "email": email,
                            "password": hash,
                            "gender": gender,
                            "profileImage": "",
                            "coverPhoto": "",
                            "dob": "",
                            "city": "",
                            "country": "",
                            "aboutMe": "",
                            "friends": [],
                            "pages": [],
                            "notifications": [],
                            "groups": [],
                            "posts": []
                        }, function (error, data) {
                            result.json({
                                "status": "success",
                                "message": "Se registró correctamente. Puede iniciar sesión ahora."
                            });
                        });
                    });
                } else {
                    result.json({
                        "status": "error",
                        "message": "El correo electrónico o el nombre de usuario ya existen.",
                    });
                }
            });
        });

        app.get("/login", function (request, result) {
            result.render("login")
        });

        /*******************************/
        /* Login */
        /*******************************/
        app.post("/login", function (request, result) {
            var email = request.fields.email;
            var password = request.fields.password;
            database.collection("users").findOne({
                "email": email
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "El email ingresado no existe"
                    });
                } else {
                    bcrypt.compare(password, user.password, function (error, isVerify) {
                        if (isVerify) {
                            var accessToken = jwt.sign({
                                email: email
                            }, accessTokenSecret);
                            database.collection("users").findOneAndUpdate({
                                "email": email
                            }, {
                                $set: {
                                    "accessToken": accessToken
                                }
                            }, function (error, data) {
                                result.json({
                                    "status": "success",
                                    "message": "Usuario ingresó correctamente",
                                    "accessToken": accessToken,
                                    "profileImage": user.profileImage
                                });
                            });
                        } else {
                            result.json({
                                "status": "error",
                                "message": "La contraseña no es correcta."
                            });
                        }
                    });
                }
            });
        });

        app.get("/updateProfile", function (request, result) {
            result.render("updateProfile")
        });

        app.post("/getUser", function (request, result) {
            var accessToken = request.fields.accessToken;
            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "El usuario ha sido desconectado. Por favor ingrsar de nuevo."
                    });
                } else {
                    result.json({
                        "status": "success",
                        "message": "Se ha recuperado el registro.",
                        "data": user
                    });
                }
            });
        });

        /*******************************/
        /* Salir */
        /*******************************/
        app.get('/logout', function (request, result) {
            result.redirect('/login');
        });

        /*******************************/
        /* Cargar imagen de portada */
        /*******************************/
        app.post("/uploadCoverPhoto", function (request, result) {
            var accessToken = request.fields.accessToken;
            var coverPhoto = "";

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Ingrese nuevamente."
                    });
                } else {
                    if (request.files.coverPhoto.size > 0 && request.files.coverPhoto.type.includes("image")) {

                        if (user.coverPhoto != "") {
                            fileSystem.unlink(user.coverPhoto, function (error) {
                                //
                            });
                        }

                        coverPhoto = "public/images/" + new Date().getTime() + "-" + request.files.coverPhoto.name;

                        // Leer el archivo
                        fileSystem.readFile(request.files.coverPhoto.path, function (err, data) {
                            if (err) throw err;
                            console.log('Archivo leído!');

                            // Escribir el archivo
                            fileSystem.writeFile(coverPhoto, data, function (err) {
                                if (err) throw err;
                                console.log('Archivo escrito!');

                                database.collection("users").updateOne({
                                    "accessToken": accessToken
                                }, {
                                    $set: {
                                        "coverPhoto": coverPhoto
                                    }
                                }, function (error, data) {
                                    result.json({
                                        "status": "status",
                                        "message": "La foto de portada se ha actualizado.",
                                        data: mainURL + "/" + coverPhoto
                                    });
                                });
                            });

                            // Eliminar el archivo
                            fileSystem.unlink(request.files.coverPhoto.path, function (err) {
                                if (err) throw err;
                                console.log('Archivo eliminado!');
                            });
                        });
                    } else {
                        result.json({
                            "status": "error",
                            "message": "Seleccione una imagen válida."
                        });
                    }
                }
            });
        });

        /*******************************/
        /* Cargar imagen de perfil */
        /*******************************/
        app.post("/uploadProfileImage", function (request, result) {
            var accessToken = request.fields.accessToken;
            var profileImage = "";

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Ingrese nuevamente."
                    });
                } else {

                    if (request.files.profileImage.size > 0 && request.files.profileImage.type.includes("image")) {
                        if (user.profileImage != "") {
                            fileSystem.unlink(user.profileImage, function (error) {
                                //
                            });
                        }

                        profileImage = "public/images/" + new Date().getTime() + "-" + request.files.profileImage.name;

                        // Leer el archivo
                        fileSystem.readFile(request.files.profileImage.path, function (err, data) {
                            if (err) throw err;
                            console.log('Archivo leído!');

                            // Escribir el archivo
                            fileSystem.writeFile(profileImage, data, function (err) {
                                if (err) throw err;
                                console.log('Archivo escrito!');

                                database.collection("users").updateOne({
                                    "accessToken": accessToken
                                }, {
                                    $set: {
                                        "profileImage": profileImage
                                    }
                                }, function (error, data) {
                                    result.json({
                                        "status": "status",
                                        "message": "La imagen de perfil se ha actualizado.",
                                        data: mainURL + "/" + profileImage
                                    });
                                });
                            });

                            // Eliminar el archivo
                            fileSystem.unlink(request.files.profileImage.path, function (err) {
                                if (err) throw err;
                                console.log('Archivo eliminado!');
                            });
                        });
                    } else {
                        result.json({
                            "status": "error",
                            "message": "Seleccione una imagen válida."
                        });
                    }
                }
            });
        });

        /*******************************/
        /* Actualizar el Perfil */
        /*******************************/
        app.post("/updateProfile", function (request, result) {
            var accessToken = request.fields.accessToken;
            var name = request.fields.name;
            var dob = request.fields.dob;
            var city = request.fields.city;
            var country = request.fields.country;
            var aboutMe = request.fields.aboutMe;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Por favor, inicie sesión de nuevo."
                    });
                } else {
                    database.collection("users").updateOne({
                        "accessToken": accessToken
                    }, {
                        $set: {
                            "name": name,
                            "dob": dob,
                            "city": city,
                            "country": country,
                            "aboutMe": aboutMe
                        }
                    }, function (error, data) {
                        result.json({
                            "status": "status",
                            "message": "El perfil ha sido actualizado."
                        });
                    });
                }
            });
        });

        app.get("/", function (request, result) {
            result.render("index");
        });

        /*******************************/
        /* Agregar publicacion */
        /*******************************/
        app.post("/addPost", function (request, result) {

            var accessToken = request.fields.accessToken;
            var caption = request.fields.caption;
            var image = "";
            var video = "";
            var type = request.fields.type;
            var createdAt = new Date().getTime();
            var _id = request.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {

                    if (request.files.image.size > 0 && request.files.image.type.includes("image")) {
                        image = "public/images/" + new Date().getTime() + "-" + request.files.image.name;

                        // Leer el archivo
                        fileSystem.readFile(request.files.image.path, function (err, data) {
                            if (err) throw err;
                            console.log('Archivo leído!');

                            // Escribir el archivo
                            fileSystem.writeFile(image, data, function (err) {
                                if (err) throw err;
                                console.log('Archivo escrito!');
                            });

                            // Eliminar el archivo
                            fileSystem.unlink(request.files.image.path, function (err) {
                                if (err) throw err;
                                console.log('Archivo eliminado!');
                            });
                        });
                    }

                    if (request.files.video.size > 0 && request.files.video.type.includes("video")) {
                        video = "public/videos/" + new Date().getTime() + "-" + request.files.video.name;

                        // Leer el archivo
                        fileSystem.readFile(request.files.video.path, function (err, data) {
                            if (err) throw err;
                            console.log('Archivo leído!');

                            // Escribir el archivo
                            fileSystem.writeFile(video, data, function (err) {
                                if (err) throw err;
                                console.log('Archivo escrito!');
                            });

                            // Eliminar el archivo
                            fileSystem.unlink(request.files.video.path, function (err) {
                                if (err) throw err;
                                console.log('Archivo eliminado!');
                            });
                        });
                    }

                    if (type == "page_post") {

                        database.collection("pages").findOne({
                            "_id": ObjectId(_id)
                        }, function (error, page) {
                            if (page == null) {
                                result.json({
                                    "status": "error",
                                    "message": "La página no existe."
                                });
                                return;
                            } else {

                                if (page.user._id.toString() != user._id.toString()) {
                                    result.json({
                                        "status": "error",
                                        "message": "Lo sentimos, no eres el propietario de esta página."
                                    });
                                    return;
                                }

                                database.collection("posts").insertOne({
                                    "caption": caption,
                                    "image": image,
                                    "video": video,
                                    "type": type,
                                    "createdAt": createdAt,
                                    "likers": [],
                                    "comments": [],
                                    "shares": [],
                                    "user": {
                                        "_id": page._id,
                                        "name": page.name,
                                        "profileImage": page.coverPhoto
                                    }
                                }, function (error, data) {
                                    result.json({
                                        "status": "success",
                                        "message": "Se ha subido la publicación."
                                    });
                                });
                            }
                        });
                    } else {
                        database.collection("posts").insertOne({
                            "caption": caption,
                            "image": image,
                            "video": video,
                            "type": type,
                            "createdAt": createdAt,
                            "likers": [],
                            "comments": [],
                            "shares": [],
                            "user": {
                                "_id": user._id,
                                "name": user.name,
                                "username": user.username,
                                "profileImage": user.profileImage
                            }
                        }, function (error, data) {

                            database.collection("users").updateOne({
                                "accessToken": accessToken
                            }, {
                                $push: {
                                    "posts": {
                                        "_id": data.insertedId,
                                        "caption": caption,
                                        "image": image,
                                        "video": video,
                                        "type": type,
                                        "createdAt": createdAt,
                                        //"likers": [],
                                        "comments": [],
                                        "shares": []
                                    }
                                }
                            }, function (error, data) {

                                result.json({
                                    "status": "success",
                                    "message": "Se ha subido la publicación."
                                });
                            });
                        });
                    }


                }
            });
        });

        /*******************************/
        /* Obtener nuevas noticias */
        /*******************************/
        app.post("/getNewsfeed", function (request, result) {
            var accessToken = request.fields.accessToken;
            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Ingrese nuevamente."
                    });
                } else {

                    var ids = [];
                    ids.push(user._id);

                    for (var a = 0; a < user.pages.length; a++) {
                        ids.push(user.pages[a]._id);
                    }

                    database.collection("posts")
                        .find({
                            "user._id": {
                                $in: ids
                            }
                        })
                        .sort({
                            "createdAt": -1
                        })
                        .limit(5)
                        .toArray(function (error, data) {

                            result.json({
                                "status": "success",
                                "message": "Se recuperó el registro.",
                                "data": data
                            });
                        });
                }
            });
        });

        /*******************************/
        /* Alternar Me gusta/No me gusta Publicación */
        /*******************************/
        app.post("/toggleLikePost", function (request, result) {

            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Por favor, inicie sesión de nuevo."
                    });
                } else {

                    database.collection("posts").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, post) {

                        if (post == null) {
                            result.json({
                                "status": "error",
                                "message": "La publicación no existe."
                            });
                        } else {

                            var isLiked = false;
                            for (var a = 0; a < post.likers.length; a++) {
                                var liker = post.likers[a];

                                if (liker._id.toString() == user._id.toString()) {
                                    isLiked = true;
                                    break;
                                }
                            }

                            if (isLiked) {
                                database.collection("posts").updateOne({
                                    "_id": ObjectId(_id)
                                }, {
                                    $pull: {
                                        "likers": {
                                            "_id": user._id,
                                        }
                                    }
                                }, function (error, data) {

                                    database.collection("users").updateOne({
                                        $and: [{
                                            "_id": post.user._id
                                        }, {
                                            "posts._id": post._id
                                        }]
                                    }, {
                                        $pull: {
                                            "posts.$[].likers": {
                                                "_id": user._id,
                                            }
                                        }
                                    });

                                    result.json({
                                        "status": "unliked",
                                        "message": "Se ha retirado el Like de la publicación."
                                    });
                                });
                            } else {

                                database.collection("users").updateOne({
                                    "_id": post.user._id
                                }, {
                                    $push: {
                                        "notifications": {
                                            "_id": ObjectId(),
                                            "type": "photo_liked",
                                            "content": user.name + " le ha gustado tu publicación.",
                                            "profileImage": user.profileImage,
                                            "isRead": false,
                                            "post": {
                                                "_id": post._id
                                            },
                                            "createdAt": new Date().getTime()
                                        }
                                    }
                                });

                                database.collection("posts").updateOne({
                                    "_id": ObjectId(_id)
                                }, {
                                    $push: {
                                        "likers": {
                                            "_id": user._id,
                                            "name": user.name,
                                            "profileImage": user.profileImage
                                        }
                                    }
                                }, function (error, data) {

                                    database.collection("users").updateOne({
                                        $and: [{
                                            "_id": post.user._id
                                        }, {
                                            "posts._id": post._id
                                        }]
                                    }, {
                                        $push: {
                                            "posts.$[].likers": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage
                                            }
                                        }
                                    });

                                    result.json({
                                        "status": "success",
                                        "message": "Se ha dado me gusta a la publicación."
                                    });
                                });
                            }

                        }
                    });

                }
            });
        });

        /*******************************/
        /* Publicar Comentarios */
        /*******************************/
        app.post("/postComment", function (request, result) {

            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;
            var comment = request.fields.comment;
            var createdAt = new Date().getTime();

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Por favor, inicie sesión de nuevo."
                    });
                } else {

                    database.collection("posts").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, post) {
                        if (post == null) {
                            result.json({
                                "status": "error",
                                "message": "La publicación no existe."
                            });
                        } else {

                            var commentId = ObjectId();

                            database.collection("posts").updateOne({
                                "_id": ObjectId(_id)
                            }, {
                                $push: {
                                    "comments": {
                                        "_id": commentId,
                                        "user": {
                                            "_id": user._id,
                                            "name": user.name,
                                            "profileImage": user.profileImage,
                                        },
                                        "comment": comment,
                                        "createdAt": createdAt,
                                        "replies": []
                                    }
                                }
                            }, function (error, data) {

                                if (user._id.toString() != post.user._id.toString()) {
                                    database.collection("users").updateOne({
                                        "_id": post.user._id
                                    }, {
                                        $push: {
                                            "notifications": {
                                                "_id": ObjectId(),
                                                "type": "new_comment",
                                                "content": user.name + " comentó en tu publicación.",
                                                "profileImage": user.profileImage,
                                                /*"post": {
                                                    "_id": post._id
                                                },
                                                "isRead": false,*/
                                                "createdAt": new Date().getTime()
                                            }
                                        }
                                    });
                                }

                                database.collection("users").updateOne({
                                    $and: [{
                                        "_id": post.user._id
                                    }, {
                                        "posts._id": post._id
                                    }]
                                }, {
                                    $push: {
                                        "posts.$[].comments": {
                                            "_id": commentId,
                                            "user": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage,
                                            },
                                            "comment": comment,
                                            "createdAt": createdAt,
                                            "replies": []
                                        }
                                    }
                                });

                                //  database.collection("posts").findOne({
                                //     "_id": ObjectId(_id)
                                // }, function (error, updatePost) {
                                result.json({
                                    "status": "success",
                                    "message": "Se ha publicado el comentario.",
                                    //"updatePost": updatePost
                                });
                                // });
                            });

                        }
                    });
                }
            });
        });

        /*******************************/
        /* Publicar Respuesta */
        /*******************************/
        app.post("/postReply", function (request, result) {

            var accessToken = request.fields.accessToken;
            var postId = request.fields.postId;
            var commentId = request.fields.commentId;
            var reply = request.fields.reply;
            var createdAt = new Date().getTime();

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Por favor, inicie sesión de nuevo."
                    });
                } else {

                    database.collection("posts").findOne({
                        "_id": ObjectId(postId)
                    }, function (error, post) {
                        if (post == null) {
                            result.json({
                                "status": "error",
                                "message": "La publicación no existe."
                            });
                        } else {

                            var replyId = ObjectId();

                            database.collection("posts").updateOne({
                                $and: [{
                                    "_id": ObjectId(postId)
                                }, {
                                    "comments._id": ObjectId(commentId)
                                }]
                            }, {
                                $push: {
                                    "comments.$.replies": {
                                        "_id": replyId,
                                        "user": {
                                            "_id": user._id,
                                            "name": user.name,
                                            "profileImage": user.profileImage,
                                        },
                                        "reply": reply,
                                        "createdAt": createdAt
                                    }
                                }
                            }, function (error, data) {

                                database.collection("users").updateOne({
                                    $and: [{
                                        "_id": post.user._id
                                    }, {
                                        "posts._id": post._id
                                    }, {
                                        "posts.comments._id": ObjectId(commentId)
                                    }]
                                }, {
                                    $push: {
                                        "posts.$[].comments.$[].replies": {
                                            "_id": replyId,
                                            "user": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage,
                                            },
                                            "reply": reply,
                                            "createdAt": createdAt
                                        }
                                    }
                                });

                                //  database.collection("posts").findOne({
                                //     "_id": ObjectId(postId)
                                // }, function (error, updatePost) {
                                result.json({
                                    "status": "success",
                                    "message": "Se ha publicado la respuesta.",
                                    //"updatePost": updatePost
                                });
                                // });
                            });

                        }
                    });
                }
            });
        });

        /*******************************/
        /* Compartir publicacion */
        /*******************************/
        app.post("/sharePost", function (request, result) {

            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;
            var type = "shared";
            var createdAt = new Date().getTime();

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Ingrese nuevamente."
                    });
                } else {

                    database.collection("posts").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, post) {
                        if (post == null) {
                            result.json({
                                "status": "error",
                                "message": "La publicación no existe."
                            });
                        } else {

                            database.collection("posts").updateOne({
                                "_id": ObjectId(_id)
                            }, {
                                $push: {
                                    "shares": {
                                        "_id": user._id,
                                        "name": user.name,
                                        "profileImage": user.profileImage
                                    }
                                }
                            }, function (error, data) {

                                database.collection("posts").insertOne({
                                    "caption": post.caption,
                                    "image": post.image,
                                    "video": post.video,
                                    "type": type,
                                    "createdAt": createdAt,
                                    "likers": [],
                                    "comments": [],
                                    "shares": [],
                                    "user": {
                                        "_id": user._id,
                                        "name": user.name,
                                        "gender": user.gender,
                                        "profileImage": user.profileImage
                                    }
                                }, function (error, data) {

                                    database.collection("users").updateOne({
                                        $and: [{
                                            "_id": post.user._id
                                        }, {
                                            "posts._id": post._id
                                        }]
                                    }, {
                                        $push: {
                                            "posts.$[].shares": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage
                                            }
                                        }
                                    });

                                    result.json({
                                        "status": "success",
                                        "message": "La publicación ha sido compartida."
                                    });
                                });
                            });
                        }
                    });
                }
            });
        });

        /*******************************/
        /* Buscar Amigos */
        /*******************************/
        app.get("/search/:query", function (request, result) {
            var query = request.params.query;
            result.render("search", {
                "query": query
            });
        });

        app.post("/search", function (request, result) {
            var query = request.fields.query;
            database.collection("users").find({
                "name": {
                    $regex: ".*" + query + ".*",
                    $options: "i"
                }
            }).toArray(function (error, data) {

                database.collection("pages").find({
                    "name": {
                        $regex: ".*" + query + ".*",
                        $options: "i"
                    }
                }).toArray(function (error, pages) {

                    result.json({
                        "status": "success",
                        "message": "Se recuperó el registro.",
                        "data": data,
                        "pages": pages
                    });
                });
            });
        });

        /*******************************/
        /* Mandar solicitud de amistad */
        /*******************************/
        app.post("/sendFriendRequest", function (request, result) {

            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Ingrese nuevamente."
                    });
                } else {
                    var me = user;
                    database.collection("users").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, user) {
                        if (user == null) {
                            result.json({
                                "status": "error",
                                "message": "El usuario no existe."
                            });
                        } else {
                            database.collection("users").updateOne({
                                "_id": ObjectId(_id)
                            }, {
                                $push: {
                                    "friends": {
                                        "_id": me._id,
                                        "name": me.name,
                                        "profileImage": me.profileImage,
                                        "status": "Pending",
                                        "sentByMe": false,
                                        "inbox": []
                                    }
                                }
                            }, function (error, data) {

                                database.collection("users").updateOne({
                                    "_id": me._id
                                }, {
                                    $push: {
                                        "friends": {
                                            "_id": user._id,
                                            "name": user.name,
                                            "profileImage": user.profileImage,
                                            "status": "Pending",
                                            "sentByMe": true,
                                            "inbox": []
                                        }
                                    }
                                }, function (error, data) {
                                    result.json({
                                        "status": "success",
                                        "message": "Se ha enviado la solicitud de amistad.",
                                    });
                                });
                            });
                        }

                    });
                }
            });
        });

        /*******************************/
        /* Amigos */
        /*******************************/
        app.get("/friends", function (request, result) {
            result.render("friends");
        });

        /*******************************/
        /* Aceptar Amigos */
        /*******************************/
        app.post("/acceptFriendRequest", function (request, result) {

            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Ingrese nuevamente.",
                    });
                } else {

                    var me = user;
                    database.collection("users").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, user) {
                        if (user == null) {
                            result.json({
                                "status": "error",
                                "message": "El usuario no existe.",
                            });
                        } else {

                            database.collection("users").updateOne({
                                "_id": ObjectId(_id)
                            }, {
                                $push: {
                                    "notifications": {
                                        "_id": ObjectId(),
                                        "type": "friend_request_accepted",
                                        "content": me.name + "aceptó su solicitud de amistad.",
                                        "profileImage": me.profileImage,
                                        "createdAt": new Date().getTime()
                                    }
                                }
                            });

                            database.collection("users").updateOne({
                                $and: [{
                                    "_id": ObjectId(_id)
                                }, {
                                    "friends._id": me._id
                                }]
                            }, {
                                $set: {
                                    "friends.$.status": "Accepted"
                                }
                            }, function (error, data) {

                                database.collection("users").updateOne({
                                    $and: [{
                                        "_id": me._id
                                    }, {
                                        "friends._id": user._id
                                    }]
                                }, {
                                    $set: {
                                        "friends.$.status": "Accepted"
                                    }
                                }, function (error, data) {
                                    result.json({
                                        "status": "success",
                                        "message": "La solicitud de amistad ha sido aceptada."
                                    });
                                });
                            });
                        }
                    });
                }
            });
        });

        /*******************************/
        /* Eliminar Amigos */
        /*******************************/
        app.post("/unfriend", function (request, result) {

            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Ingrese nuevamente.",
                    });
                } else {
                    var me = user;
                    database.collection("users").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, user) {
                        if (user == null) {
                            result.json({
                                "status": "error",
                                "message": "El usuario no existe.",
                            });
                        } else {

                            database.collection("users").updateOne({
                                "_id": ObjectId(_id)
                            }, {
                                $pull: {
                                    "friends": {
                                        "_id": me._id
                                    }
                                }
                            }, function (error, data) {

                                database.collection("users").updateOne({
                                    "_id": me._id
                                }, {
                                    $pull: {
                                        "friends": {
                                            "_id": user._id
                                        }
                                    }
                                }, function (error, data) {

                                    result.json({
                                        "status": "success",
                                        "message": "Tu amigo ha sido eliminado.",
                                    });
                                });
                            });
                        }
                    });
                }
            });
        });

        /*******************************/
        /* Mensajes */
        /*******************************/
        app.get("/inbox", function (request, result) {
            result.render("inbox");
        });

        /*******************************/
        /* Obtener amigos en el chat */
        /*******************************/
        app.post("/getFriendsChat", function (request, result) {
            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Ingrese nuevamente."
                    });
                } else {

                    var index = user.friends.findIndex(function (friend) {
                        return friend._id == _id
                    });
                    var inbox = user.friends[index].inbox;

                    result.json({
                        "status": "success",
                        "message": "Se recuperó el registro.",
                        "data": inbox
                    });
                }
            })
        });

        /*******************************/
        /* Enviar Mensajes*/
        /*******************************/
        app.post("/sendMessage", function (request, result) {

            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;
            var message = request.fields.message;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Ingrese nuevamente."
                    });
                } else {
                    var me = user;
                    database.collection("users").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, user) {
                        if (user == null) {
                            result.json({
                                "status": "error",
                                "message": "El usuario no existe."
                            });
                        } else {
                            database.collection("users").updateOne({
                                $and: [{
                                    "_id": ObjectId(_id)
                                }, {
                                    "friends._id": me._id
                                }]
                            }, {
                                $push: {
                                    "friends.$.inbox": {
                                        "_id": ObjectId(),
                                        "message": message,
                                        "from": me._id
                                    }
                                }
                            }, function (error, data) {

                                database.collection("users").updateOne({
                                    $and: [{
                                        "_id": me._id
                                    }, {
                                        "friends._id": user._id
                                    }]
                                }, {
                                    $push: {
                                        "friends.$.inbox": {
                                            "_id": ObjectId(),
                                            "message": message,
                                            "from": me._id
                                        }
                                    }
                                }, function (error, data) {

                                    socketIO.to(users[user._id]).emit("messageReceived", {
                                        "message": message,
                                        "from": me._id
                                    });

                                    result.json({
                                        "status": "success",
                                        "message": "El mensaje ha sido enviado."
                                    });
                                });
                            });
                        }
                    });
                }
            });
        });

        /*******************************/
        /* Agregando socketIO en el chat */
        /*******************************/
        app.post('/connectSocket', function (request, result) {
            var accessToken = request.fields.accessToken;
            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Ingrese nuevamente."
                    });
                } else {
                    users[user._id] = socketID;
                    result.json({
                        "status": "status",
                        "message": "Socket conectado."
                    });
                }
            });
        });

        /*******************************/
        /* Crear paginas */
        /*******************************/
        app.get("/createPage", function (request, result) {
            result.render("createPage");
        });

        app.post("/createPage", function (request, result) {

            var accessToken = request.fields.accessToken;
            var name = request.fields.name;
            var domainName = request.fields.domainName;
            var additionalInfo = request.fields.additionalInfo;
            var coverPhoto = "";

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Ingrese nuevamente."
                    });
                } else {

                    if (request.files.coverPhoto.size > 0 && request.files.coverPhoto.type.includes("image")) {
                        coverPhoto = "public/images/" + new Date().getTime() + "-" + request.files.coverPhoto.name;

                        // Leer el archivo
                        fileSystem.readFile(request.files.coverPhoto.path, function (err, data) {
                            if (err) throw err;
                            console.log('Archivo leído!');

                            // Escribir el archivo
                            fileSystem.writeFile(coverPhoto, data, function (err) {
                                if (err) throw err;
                                console.log('Archivo escrito!');
                            });

                            // Eliminar el archivo
                            fileSystem.unlink(request.files.coverPhoto.path, function (err) {
                                if (err) throw err;
                                console.log('Archivo eliminado!');
                            });
                        });

                        database.collection("pages").insertOne({
                            "name": name,
                            "domainName": domainName,
                            "additionalInfo": additionalInfo,
                            "coverPhoto": coverPhoto,
                            "likers": [],
                            "user": {
                                "_id": user._id,
                                "name": user.name,
                                "profileImage": user.profileImage
                            }
                        }, function (error, data) {

                            result.json({
                                "status": "success",
                                "message": "La página ha sido creada."
                            });

                        });
                    } else {
                        result.json({
                            "status": "error",
                            "message": "Selecciona una foto de portada."
                        });

                    }
                }
            });
        });


        /*******************************/
        /* Visualizar paginas */
        /*******************************/
        app.get("/pages", function (request, result) {
            result.render("pages");
        });

        app.post("/getPages", function (request, result) {
            var accessToken = request.fields.accessToken;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Ingrese nuevamente."
                    });
                } else {

                    database.collection("pages").find({
                        $or: [{
                            "user._id": user._id,
                        }, {
                            "likers._id": user._id
                        }]
                    }).toArray(function (error, data) {

                        result.json({
                            "status": "success",
                            "message": "Se recuperó el registro.",
                            "data": data
                        });
                    });
                }
            });
        });


        /*******************************/
        /* Visualizar CADA paginas */
        /*******************************/
        app.get("/page/:_id", function (request, result) {
            var _id = request.params._id;

            database.collection("pages").findOne({
                "_id": ObjectId(_id)
            }, function (error, page) {
                if (page == null) {
                    result.json({
                        "status": "error",
                        "message": "La página no existe."
                    });
                } else {
                    result.render("singlePage", {
                        "_id": _id
                    });
                }
            });
        });

        app.post("/getPageDetail", function (request, result) {
            var _id = request.fields._id;

            database.collection("pages").findOne({
                "_id": ObjectId(_id)
            }, function (error, page) {
                if (page == null) {
                    result.json({
                        "status": "error",
                        "message": "La página no existe."
                    });
                } else {

                    database.collection("posts").find({
                        $and: [{
                            "user._id": page._id
                        }, {
                            "type": "page_post"
                        }]
                    }).toArray(function (error, posts) {
                        result.json({
                            "status": "success",
                            "message": "Se recuperó el registro.",
                            "data": page,
                            "posts": posts
                        });
                    });
                }
            });
        });

        app.post("/toggleLikePage", function (request, result) {
            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Ingrese nuevamente."
                    });
                } else {
                    database.collection("pages").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, page) {
                        if (page == null) {
                            result.json({
                                "status": "error",
                                "message": "La página no existe."
                            });
                        } else {

                            var isLiked = false;
                            for (var a = 0; a < page.likers.length; a++) {
                                var liker = page.likers[a];

                                if (liker._id.toString() == user._id.toString()) {
                                    isLiked = true;
                                    break;
                                }
                            }

                            if (isLiked) {
                                database.collection("pages").updateOne({
                                    "_id": ObjectId(_id)
                                }, {
                                    $pull: {
                                        "likers": {
                                            "_id": user._id,
                                        }
                                    }
                                }, function (error, data) {

                                    database.collection("users").updateOne({
                                        "accessToken": accessToken
                                    }, {
                                        $pull: {
                                            "pages": {
                                                "_id": ObjectId(_id)
                                            }
                                        }
                                    }, function (error, data) {
                                        result.json({
                                            "status": "unliked",
                                            "message": "No se ha dado me gusta a la página."
                                        });
                                    });
                                });
                            } else {
                                database.collection("pages").updateOne({
                                    "_id": ObjectId(_id)
                                }, {
                                    $push: {
                                        "likers": {
                                            "_id": user._id,
                                            "name": user.name,
                                            "profileImage": user.profileImage
                                        }
                                    }
                                }, function (error, data) {

                                    database.collection("users").updateOne({
                                        "accessToken": accessToken
                                    }, {
                                        $push: {
                                            "pages": {
                                                "_id": page._id,
                                                "name": page.name,
                                                "coverPhoto": page.coverPhoto
                                            }
                                        }
                                    }, function (error, data) {
                                        result.json({
                                            "status": "success",
                                            "message": "Le ha dado me gusta a la página."
                                        });
                                    });
                                });
                            }
                        }
                    });
                }
            });
        });

        app.post("/getMyPages", function (request, result) {
            var accessToken = request.fields.accessToken;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Se ha cerrado la sesión del usuario. Ingrese nuevamente."
                    });
                } else {

                    database.collection("pages").find({
                        "user._id": user._id
                    }).toArray(function (error, data) {
                        result.json({
                            "status": "error",
                            "message": "Se recuperó el registro.",
                            "data": data
                        });
                    });
                }
            });
        });

    });
});