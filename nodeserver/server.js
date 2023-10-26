const express = require('express');
const path = require('path'); 
const app = express();
const port = 5000;
app.use(express.json());
app.use(bodyParser.json());


app.get("/comprar", (req, res) => {
  res.sendFile(path.resolve("./comprar.html"));
});

app.post("/comprar", (req, res) => {
  try {
    const purchaseData = req.body;
    console.log('Datos de compra:', purchaseData);
    res.json({ message: 'Compra exitosa' });
  } catch (error) {
    console.error('Error al procesar la compra de lado del servidor:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


app.post("/registro", (req, res) => {
  try {
    const formData = req.body;
    console.log(formData)
    const errors = validateFormData(formData);
    if (Object.keys(errors).length === 0) {
      console.log(formData);
      res.status(200).json({ message: "Datos recibidos con éxito" });
    } else {
      res.status(400).json({ errors });
    }
  } catch (error) {
    console.error("Error al procesar la solicitud:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.listen(port, () => {
  console.log(`Servidor en ejecución en http://localhost:${port}`);
});



