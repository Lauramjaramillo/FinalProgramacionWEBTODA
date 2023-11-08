const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { MongoClient } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

const port = 5000;

// Conectarse a la base de datos MongoDB
const dbUrl = "mongodb://localhost:27017";
const dbName = "pagina";
let db;

async function connectToDatabase() {
  try {
    const connection = new MongoClient(dbUrl, { useUnifiedTopology: true });
    await connection.connect();
    console.log("Conectado a MongoDB");
    db = connection.db(dbName);
  } catch (error) {
    console.error("Error al conectar a MongoDB:", error);
  }
}

connectToDatabase();

// Rutas para obtener productos y comprar
app.get("/productoslist", async (req, res) => {
  try {
    const productos = await db.collection("productos").find({}).toArray();
    res.send({ productos });
  } catch (error) {
    console.error("Error al buscar productos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/comprar", (req, res) => {
  res.sendFile(path.resolve(__dirname, "comprar.html"));
});

app.post("/comprar", async (req, res) => {
  try {
    const purchaseData = req.body;
    const comprasCollection = db.collection("compras");

    await comprasCollection.insertOne(purchaseData);

    const productsCollection = db.collection("productos");
    const purchasedItems = purchaseData.items; // Accedemos a la matriz 'items' en lugar de 'purchaseData[0].products'

    for (const item of purchasedItems) {
      const title = item.title; // Cambiamos 'id' a 'title' para buscar el producto por el título

      const product = await productsCollection.findOne({
        "products.title": title,
      });

      if (product) {
        const updatedProducts = product.products.map((p) => {
          if (p.title === title) {
            p.stock -= item.quantity;
          }
          return p;
        });

        await productsCollection.updateOne(
          { _id: product._id },
          {
            $set: {
              products: updatedProducts,
            },
          }
        );
      } else {
        console.error("Producto no encontrado:", title);
      }
    }

    console.log("Compra registrada en la base de datos:", purchaseData);
    res.json({ success: true, message: "Compra exitosa", purchaseData });
  } catch (error) {
    console.error("Error al procesar la compra de lado del servidor:", error);
    res
      .status(500)
      .json({ success: false, error: "Error interno del servidor" });
  }
});

// Función de validación de formData
function validateFormData(formData) {
  // Implementa la lógica de validación aquí
  return {}; // Cambia esto según tus requisitos
}

// Ruta de registro de usuarios
app.post("/registro", async (req, res) => {
  try {
    const formData = req.body;
    const errors = validateFormData(formData);

    if (Object.keys(errors).length === 0) {
      // Verificar si el usuario con el correo electrónico proporcionado ya existe
      const userExists = await checkIfUserExists(formData.inputemail);

      if (userExists) {
        console.log("El usuario ya existe");
        return res.status(400).json({ error: "El usuario ya existe" });
      }

      // Agregar el campo "rol" con valor por defecto "user" al formulario
      formData.rol = "user";
      // Si el usuario no existe, insertar los datos en la base de datos
      const result = await insertDataIntoDatabase(formData);

      if (result) {
        console.log("Datos insertados con éxito:", formData);
        return res.status(200).json({ message: "Datos recibidos con éxito" });
      } else {
        return res
          .status(500)
          .json({ error: "Error al insertar datos en MongoDB" });
      }
    } else {
      return res.status(400).json({ errors });
    }
  } catch (error) {
    console.error("Error al procesar la solicitud:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

async function checkIfUserExists(email) {
  const existingUser = await db
    .collection("usuarios")
    .findOne({ inputemail: email });
  return !!existingUser;
}

async function insertDataIntoDatabase(formData) {
  try {
    const result = await db.collection("usuarios").insertOne(formData);
    return result !== undefined;
  } catch (error) {
    console.error("Error al insertar datos en MongoDB:", error);
    return false;
  }
}

// Ruta de autenticación y protegida
app.post("/ingresar", async (req, res) => {
  const { usuario, contraseña } = req.body;
  const user = await db.collection("usuarios").findOne({ inputemail: usuario });

  if (!user || user.inputpassword !== contraseña) {
    return res.status(401).json({ message: "Autenticación fallida" });
  }

  const secretKey = "your-secret-key"; // Reemplaza con tu clave secreta
  const token = jwt.sign(
    { userId: user._id, inputemail: user.inputemail },
    secretKey
  );

  res.json({ token });
});

app.get("/protected", verifyToken, (req, res) => {
  res.json({ message: "Esta es una ruta protegida", user: req.user });
});

function verifyToken(req, res, next) {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(403).json({ message: "Token no proporcionado" });
  }

  const secretKey = "your-secret-key"; // Reemplaza con tu clave secreta

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      return res.status(401).json({ message: "Token inválido" });
    }

    req.user = user;
    next();
  });
}

// Ruta para obtener la página de administrador (protegida)
app.get("/administrador", verifyToken, (req, res) => {
  console.log("Rol del usuario:", req.user.role); // Esta línea muestra el rol del usuario en la consola
  // Verificamos que el usuario tiene el rol de "admin" antes de permitir el acceso
  if (req.user.role === "admin") {
    res.sendFile(path.resolve(__dirname, "administrador.html"));
  } else {
    res.status(403).json({ message: "Acceso denegado. Debes ser administrador." });
  }
});

// Middleware para verificar el token JWT
function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  // Verificamos y decodificamos el token
  const secretKey = "tu_secreto_secreto"; // Debes definir tu propia clave secreta
  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Token inválido" });
    }

    // Guardamos los datos del usuario en el objeto `req` para su posterior uso
    req.user = decoded;
    next();
  });
}



app.listen(port, () => {
  console.log(`Servidor en ejecución en http://localhost:${port}`);
});
