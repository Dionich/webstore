const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const app = express();
const bodyParser = require('body-parser');
const http = require('http');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const port = 3001;
let isUserAuthenticated = false;

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: function (req, file, cb) {
    const randomName = Math.random().toString(36).substring(7);
    const fileExtension = file.originalname.split('.').pop();
    const newFileName = `${randomName}.${fileExtension}`;

    req.filename = newFileName;
    cb(null, newFileName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fieldNameSize: 120,
    fieldSize: 15 * 1024 * 1024
  }
});

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'WebStore'
});

connection.connect((err) => {
  if (err) {
    console.error('Помилка підключення до бази даних:' + err.stack);
    return;
  }
  console.log('Підключено до бази даних');
});


app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));
app.use('/uploads', express.static('uploads'));
app.use(cors());
app.use(cookieParser());
const server = http.createServer((req, res) => {
  req.server.maxHeaderSize = 5 * 1024 * 1024;
});
app.timeout = 30000;
app.use(session({
  secret: 'my-very-strong-and-random-secret-key-12345',
  resave: false,
  saveUninitialized: true
}));
const cookieOptions = {
  sameSite: 'None',
  secure: true
};

app.listen(port, () => {
  console.log('Сервер запущено на порту ' + port);
});

function requireAuthentication(req, res, next) {
  const userId = req.headers.userId;
  if (userId) {
    res.status(401).send('Необхідна автентифікація');
    return;
  }
  else if (userId) {
    res.status(500).send('Користувач авторизовано');
    return;
  }
  next();
}
app.get('/product/:id', (req, res) => {
  const productId = req.params.id;

  const sql = 'SELECT * FROM products WHERE id = ?';
  connection.query(sql, [productId], (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних: ' + error.stack);
      res.status(500).send('Помилка при отриманні інформації про товар');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Товар не знайдено');
      return;
    }

    const product = results[0];
    res.render('product', { product: product });
  });
});

app.post('/register', upload.fields([]), (req, res) => {
  const { username, email, password } = req.body;

  console.log('Отримано дані реєстрації:');
  console.log("Ім'я користувача:", username);
  console.log('Email:', email);
  console.log('Пароль:', password);

  const checkUniqueUsernameSql = 'SELECT * FROM users WHERE username = ?';
  const checkUniqueUsernameValues = [username];

  connection.query(checkUniqueUsernameSql, checkUniqueUsernameValues, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних: ' + error.stack);
      res.status(500).send('Помилка під час реєстрації користувача');
      return;
    }

    if (results.length > 0) {
      res.status(400).json({ error: 'Логін вже зайнятий' });
      return;
    }

    const checkUniqueEmailSql = 'SELECT * FROM users WHERE email = ?';
    const checkUniqueEmailValues = [email];

    connection.query(checkUniqueEmailSql, checkUniqueEmailValues, (error, results) => {
      if (error) {
        console.error('Помилка під час виконання запиту до бази даних:' + error.stack);
        res.status(500).send('Помилка під час реєстрації користувача');
        return;
      }

      if (results.length > 0) {
        res.status(400).json({ error: 'Пошта вже зайнята' });
        return;
      }

      const createUserSql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
      const createUserValues = [username, email, password];

      connection.query(createUserSql, createUserValues, (error, userResults) => {
        if (error) {
          console.error('Помилка під час виконання запиту до бази даних: ' + error.stack);
          res.status(500).send('Помилка під час реєстрації користувача');
          return;
        }

        const userId = userResults.insertId;

        const createCartSql = 'INSERT INTO carts (user_id) VALUES (?)';
        const createCartValues = [userId];

        connection.query(createCartSql, createCartValues, (error, cartResults) => {
          if (error) {
            console.error('Помилка під час створення кошика для користувача:' + error.stack);
            res.status(500).send('Помилка під час реєстрації користувача');
            return;
          }

          res.json({ message: 'Реєстрація пройшла успішно' });
        });
      });
    });
  });
});

app.post('/login', upload.fields([]), (req, res) => {
  const { username, password } = req.body;

  console.log('Отримано дані авторизації:');
  console.log("Ім'я користувача:", username);
  console.log('Пароль:', password);

  const isUserSql = 'SELECT * FROM users WHERE (username = ? AND password = ?) OR (username = ? AND password = ? AND role = "admin")';
  const values = [username, password, username, password];

  connection.query(isUserSql, values, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних:' + error.stack);
      res.status(500).send('Помилка авторизації користувача');
      return;
    }

    if (results.length > 0) {
      const user = results.find(row => row.username === username && row.password === password);
      const isAdmin = user.role === 'admin';
      const isUser = user.role === 'user'
      isUserAuthenticated = true;
      const userId = user.id;

      if (isAdmin) {
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ isAdmin });
      } else if (isUser) {
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ isUserAuthenticated, userId });
      }
      return;
    }

    res.status(401).send('Невірні дані авторизації');
  });
});
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Помилка при видаленні сесії: ' + err);
      res.status(500).send('Помилка під час виконання виходу');
      return;
    }

    isUserAuthenticated = false;
    res.sendStatus(200);
  });
});
app.get('/user', (req, res) => {
  const user = {
    name: req.session.username
  };

  res.render('user', { user });
});
app.get('/user/cart', (req, res) => {
  const userId = req.session.userId;

  const sql = 'SELECT * FROM carts WHERE user_id = ?';
  const values = [userId];

  connection.query(sql, values, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних: ' + error.stack);
      res.status(500).send('Помилка при отриманні кошика користувача');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Кошик користувача не знайдено');
      return;
    }

    const cart = results[0];
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ cart });
  });
});


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/admin.html');
});
app.get('/payment', (req, res) => {
  res.sendFile(__dirname + '/payment.html');
});
app.get('/confirmation', (req, res) => {
  res.sendFile(__dirname + '/confirmation.html');
});
app.use((err, req, res, next) => {
  console.error('Внутрішня помилка сервера:', err);
  res.status(500).send('Щось пішло не так на сервері');
});

app.use((err, req, res, next) => {
  res.status(404).send('Page Not Found');
});


//Endpoints by admin panel
app.get('/api/users', (req, res) => {
  const sql = 'SELECT * FROM users';

  connection.query(sql, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних:' + error.stack);
      res.status(500).send('Помилка при отриманні даних про користувачів');
      return;
    }

    res.json(results);
  });
});
app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'SELECT * FROM users WHERE id = ?';
  const values = [id];

  connection.query(sql, values, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних:' + error.stack);
      res.status(500).send('Помилка при отриманні даних користувача');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Користувач не знайдений');
      return;
    }

    const userData = results[0];
    res.json(userData);
  });
});
app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const updatedUserData = req.body;

  connection.query('UPDATE users SET ? WHERE id = ?', [updatedUserData, id], (err, result) => {
    if (err) {
      console.error('Помилка під час оновлення даних користувачів:', err);
      res.status(500).json({ error: 'Помилка під час оновлення даних користувачів' });
    } else {
      console.log('Дані користувача успішно оновлено');
      res.json({ message: 'Дані користувача успішно оновлено' });
    }
  });
});
app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  const deleteCartItemsSql = 'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)';
  const deleteCartItemsValues = [userId];
  connection.query(deleteCartItemsSql, deleteCartItemsValues, (error, deleteCartItemsResults) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних: ' + error.stack);
      res.status(500).send('Помилка при видаленні користувача');
      return;
    }

    const deleteCartsSql = 'DELETE FROM carts WHERE user_id = ?';
    const deleteCartsValues = [userId];

    connection.query(deleteCartsSql, deleteCartsValues, (error, deleteCartsResults) => {
      if (error) {
        console.error('Помилка під час виконання запиту до бази даних: ' + error.stack);
        res.status(500).send('Помилка при видаленні користувача');
        return;
      }

      const deleteUserSql = 'DELETE FROM users WHERE id = ?';
      const deleteUserValues = [userId];

      connection.query(deleteUserSql, deleteUserValues, (error, deleteResults) => {
        if (error) {
          console.error('Помилка під час виконання запиту до бази даних: ' + error.stack);
          res.status(500).send('Помилка при видаленні користувача');
          return;
        }

        res.json({ message: 'Користувач успішно видалено' });
      });
    });
  });
});









app.get('/api/products', (req, res) => {
  const sql = 'SELECT * FROM products';

  connection.query(sql, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних:' + error.stack);
      res.status(500).send('Помилка при отриманні даних про товари');
      return;
    }

    res.json(results);
  });
});
app.get('/api/products/sort', (req, res) => {
  const sortBy = req.query.sortBy;

  let sql = 'SELECT * FROM products';

  switch (sortBy) {
    case 'price':
      sql += ' ORDER BY price';
      break;
    case 'price_desc':
      sql += ' ORDER BY price DESC';
      break;
    default:
      sql += ` WHERE filter = '${sortBy}'`;
      break;
  }


  connection.query(sql, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних:' + error.stack);
      res.status(500).send('Помилка при отриманні даних про товари');
      return;
    }

    res.json(results);
  });
});

app.get('/api/products/search', (req, res) => {
  const searchQuery = req.query.query;

  if (!searchQuery) {
    res.status(400).send('Параметр "query" не указан');
    return;
  }

  // SQL-запрос для поиска товаров
  const sqlQuery = `SELECT * FROM products WHERE name LIKE '%${searchQuery}%' LIMIT 5`;

  // Выполнение SQL-запроса
  connection.query(sqlQuery, (error, results) => {
    if (error) {
      res.status(500).send('Ошибка при получении данных о товарах: ' + error.message);
    } else {
      res.json(results);
    }
  });
});



app.post('/api/products', upload.single('imageBody'), (req, res) => {
  const { name, price, description, en_description, image, filter } = req.body;
  const imageBody = req.file;
  const imageFileName = req.filename;

  const uploadPath = `uploads/${imageFileName}`;
  fs.copyFileSync(imageBody.path, uploadPath);

  const sql = 'INSERT INTO products (name, price, description, en_description, image, image_name, filter) VALUES (?, ?, ?, ?, ?, ?, ?)';
  const values = [name, price, description, en_description, image, imageFileName, filter];

  connection.query(sql, values, (error, results) => {
    if (error) {
      console.error('Database query error: ' + error.stack);
      res.status(500).json({ message: 'Error adding product' });
      return;
    } else {
      res.json({ message: 'Product added successfully' });
    }
  });
});
// app.post('/api/products', upload.single('image'), (req, res) => {
//   const { name, price, description } = req.body;
//   const image = req.file.buffer;

//   const sql = 'INSERT INTO products (name, price, description, image) VALUES (?, ?, ?, ?)';
//   const values = [name, price, description, image];

//   connection.query(sql, values, (error, results) => {
//     if (error) {
//       console.error('Database query error: ' + error.stack);
//       res.status(500).json({ message: 'Error adding product' });
//       return;
//     } else {
//       res.json({ message: 'Product added successfully' });
//     }
//   });
// });
app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'SELECT * FROM products WHERE id = ?';
  const values = [id];

  connection.query(sql, values, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних:' + error.stack);
      res.status(500).send('Помилка при отриманні даних товару');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Товар не знайдено');
      return;
    }

    const productData = results[0];
    res.json(productData);
  });
});
app.put('/api/products/:id', upload.single('imageBody'), (req, res) => {
  const productId = req.params.id;
  const updatedProductData = req.body;
  const updatedImageName = req.filename ? req.file.filename : null;
  if (Object.keys(updatedProductData).length === 0) {
    return res.status(400).json({ error: 'Не вказано поля для оновлення' });
  }

  const sqlSelect = 'SELECT image_name FROM products WHERE id = ?';
  connection.query(sqlSelect, [productId], (err, results) => {
    if (err) {
      console.error('Помилка при отриманні інформації про попереднє зображення товару:', err);
      res.status(500).json({ error: 'Помилка під час оновлення даних товару' });
      return;
    }

    const previousImageName = results[0].image_name;

    let sql = `UPDATE products SET ? WHERE id = ?`;
    let values = [updatedProductData, productId];

    if (updatedImageName) {
      if (updatedImageName !== previousImageName) {
        console.log("Попереднє ім'я зображення:", previousImageName);
        console.log("Нове ім'я зображення:", updatedImageName);

        if (previousImageName) {
          const previousImagePath = `uploads/${previousImageName}`;
          fs.unlink(previousImagePath, (err) => {
            if (err) {
              console.error('Помилка при видаленні попереднього зображення товару:', err);
            } else {
              console.log('Попереднє зображення товару успішно видалено');
            }
          });
        }
      }

      sql = `UPDATE products SET ?, image_name = ? WHERE id = ?`;
      values = [updatedProductData, updatedImageName, productId];
    }

    connection.query(sql, values, (err, result) => {
      if (err) {
        console.error('Ошибка при обновлении данных товара:', err);
        res.status(500).json({ error: 'Ошибка при обновлении данных товара' });
      } else {
        console.log('Данные товара успешно обновлены');
        res.json({ message: 'Данные товара успешно обновлены' });
      }
    });
  });
});
app.delete('/api/products/:id', (req, res) => {
  const productId = req.params.id;

  const checkProductSql = 'SELECT * FROM products WHERE id = ?';
  const checkProductValues = [productId];

  connection.query(checkProductSql, checkProductValues, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних:' + error.stack);
      res.status(500).send('Помилка при видаленні товару');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Товар не знайдено');
      return;
    }

    const deleteProductSql = 'DELETE FROM products WHERE id = ?';
    const deleteProductValues = [productId];

    connection.query(deleteProductSql, deleteProductValues, (error, results) => {
      if (error) {
        console.error('Помилка під час виконання запиту до бази даних: ' + error.stack);
        res.status(500).send('Помилка при видаленні товару');
        return;
      }

      res.json({ message: 'Товар успішно видалено' });
    });
  });
});












app.get('/api/filters', (req, res) => {
  const sql = 'SELECT * FROM filters';

  connection.query(sql, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних: ' + error.stack);
      res.status(500).send('Помилка при отриманні даних про фільтри');
      return;
    }

    res.json(results);
  });
});
app.post('/api/filters', (req, res) => {
  const { name, en_name } = req.body;

  const sql = 'INSERT INTO filters (name, en_name) VALUES (?)';
  const values = [[name, en_name]];

  connection.query(sql, values, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних:' + error.stack);
      res.status(500).send('Помилка при додаванні фільтра');
      return;
    }

    res.json({ success: true });
  });
});
app.get('/api/filters/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'SELECT * FROM filters WHERE id = ?';
  const values = [id];

  connection.query(sql, values, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних: ' + error.stack);
      res.status(500).send('Помилка при отриманні даних фільтра');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Фільтр не знайдено');
      return;
    }

    const filterData = results[0];
    res.json(filterData);
  });
});
app.put('/api/filters/:id', (req, res) => {
  const { id } = req.params;
  const updatedUserData = req.body;

  const sql = 'UPDATE filters SET ? WHERE id = ?';
  const values = [updatedUserData, id];

  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error('Помилка при оновленні даних фільтра:', err);
      res.status(500).json({ error: 'Ошибка при оновленні даних фільтра' });
    } else {
      console.log('Дані фільтра успішно оновлені');
      res.json({ message: 'Дані фільтра успішно оновлені' });
    }
  });
});
app.delete('/api/filters/:id', (req, res) => {
  const filterId = req.params.id;

  const checkFilterSql = 'SELECT * FROM filters WHERE id = ?';
  const checkFilterValues = [filterId];

  connection.query(checkFilterSql, checkFilterValues, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних: ' + error.stack);
      res.status(500).send('Помилка при видаленні фільтра');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Фільтр не знайдено');
      return;
    }

    const deleteFilterSql = 'DELETE FROM filters WHERE id = ?';
    const deleteFilterValues = [filterId];

    connection.query(deleteFilterSql, deleteFilterValues, (error, results) => {
      if (error) {
        console.error('Помилка під час виконання запиту до бази даних:' + error.stack);
        res.status(500).send('Помилка при видаленні фільтра');
        return;
      }

      res.json({ message: 'Фільтр успішно видалено' });
    });
  });
});





app.get('/cartItems', requireAuthentication, (req, res) => {
  const userId = req.headers.userid;

  const getAllCartItemsQuery = 'SELECT cart_items.id, cart_items.product_id, products.name FROM cart_items INNER JOIN products ON cart_items.product_id = products.id WHERE cart_items.cart_id IN (SELECT id FROM carts WHERE user_id = ?)';
  const getAllCartItemsValues = [userId];

  connection.query(getAllCartItemsQuery, getAllCartItemsValues, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних:', error);
      res.status(500).send('Помилка при отриманні даних із таблиці');
      return;
    }

    results.forEach((item) => {

    });

    res.json(results);
  });
});
app.get('/cartItems/:id', requireAuthentication, (req, res) => {
  const userId = req.params.id;

  const getCartItemsQuery = 'SELECT cart_items.id, cart_items.product_id, products.name FROM cart_items INNER JOIN products ON cart_items.product_id = products.id WHERE cart_items.cart_id IN (SELECT id FROM carts WHERE user_id = ?)';
  const getCartItemsValues = [userId];

  connection.query(getCartItemsQuery, getCartItemsValues, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних:', error);
      res.status(500).send('Помилка при отриманні даних із таблиці');
      return;
    }

    res.json(results);
  });
});

app.delete('/cartItems', requireAuthentication, (req, res) => {
  const userId = req.headers.userid;

  const deleteCartItemsQuery = 'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)';
  const deleteCartItemsValues = [userId];

  connection.query(deleteCartItemsQuery, deleteCartItemsValues, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних:', error);
      res.status(500).send('Помилка видалення записів');
      return;
    }

    res.sendStatus(200);
  });
});
app.delete('/cartItems/:cartItemId', requireAuthentication, (req, res) => {
  const userId = req.headers.userid;
  const cartItemId = req.params.cartItemId;

  const deleteCartItemQuery = 'DELETE FROM cart_items WHERE id = ? AND cart_id IN (SELECT id FROM carts WHERE user_id = ?)';
  const deleteCartItemValues = [cartItemId, userId];

  connection.query(deleteCartItemQuery, deleteCartItemValues, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних:', error);
      res.status(500).send('Помилка при видаленні запису');
      return;
    }

    res.sendStatus(200);
  });
});
app.post('/addToCart', requireAuthentication, (req, res) => {
  const { productId, userId } = req.body;

  if (!productId) {
    res.status(400).send('Не вказано ідентифікатора товару');
    return;
  }

  if (!userId) {
    res.status(401).send('Необхідна автентифікація');
    return;
  }

  // Проверка, что пользователь существует в базе данных
  const checkUserQuery = 'SELECT * FROM users WHERE id = ?';
  connection.query(checkUserQuery, userId, (error, userResults) => {
    if (error) {
      console.error('Ошибка при проверке пользователя:', error);
      res.status(500).send('Ошибка при проверке пользователя');
      return;
    }

    if (userResults.length === 0) {
      res.status(401).send('Пользователь не найден');
      return;
    }

    // Поиск существующей корзины пользователя
    const findCartQuery = 'SELECT * FROM carts WHERE user_id = ?';
    connection.query(findCartQuery, userId, (error, cartResults) => {
      if (error) {
        console.error('Ошибка при поиске корзины:', error);
        res.status(500).send('Ошибка при поиске корзины');
        return;
      }

      let cartId;
      const createCartQuery = 'INSERT INTO carts (user_id) VALUES (?)';


      if (cartResults.length === 0) {
        connection.query(createCartQuery, userId, (error, createCartResult) => {
          if (error) {
            console.error('Ошибка при создании корзины:', error);
            res.status(500).send('Ошибка при создании корзины');
            return;
          }

          cartId = createCartResult.insertId;

          // Добавление товара в корзину
          const cartItem = {
            cart_id: cartId,
            product_id: productId,
            quantity: 1 // Здесь можно указать нужное количество товара
          };

          connection.query('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)', [cartItem.cart_id, cartItem.product_id, cartItem.quantity], (error, results) => {
            if (error) {
              console.error('Ошибка при добавлении товара в корзину:', error);
              res.status(500).send('Ошибка при добавлении товара в корзину');
              return;
            }

            res.sendStatus(200);
          });
        });
      } else {
        cartId = cartResults[0].id;

        // Добавление товара в существующую корзину
        const cartItem = {
          cart_id: cartId,
          product_id: productId,
          quantity: 1 // Здесь можно указать нужное количество товара
        };

        connection.query('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)', [cartItem.cart_id, cartItem.product_id, cartItem.quantity], (error, results) => {
          if (error) {
            console.error('Ошибка при добавлении товара в корзину:', error);
            res.status(500).send('Ошибка при добавлении товара в корзину');
            return;
          }

          res.sendStatus(200);
        });
      }
    });
  });
});

// Endpoint for handling the purchase request
app.post('/purchase', (req, res) => {
  const { userId, receiptNumber } = req.body;

  const insertQuery = `
    INSERT INTO purchase_history (user_id, product_id, purchase_date, status, receipt_number)
    SELECT c.user_id, ci.product_id, NOW(), 'Створено', '${receiptNumber}'
    FROM cart_items ci
    JOIN carts c ON ci.cart_id = c.id
    WHERE c.user_id = ${userId}`;

  connection.query(insertQuery, (error, insertResults) => {
    if (error) {
      console.error('Помилка виконання запиту:', error);
      res.status(500).json({ error: 'Сталася помилка при обробці покупки.' });
    } else {
      const purchaseId = insertResults && insertResults.insertId;

      if (!purchaseId) {
        console.error('Помилка отримання ідентифікатора покупки.');
        res.status(500).json({ error: 'Сталася помилка під час обробки покупки.' });
        return;
      }

      res.status(200).json({ message: 'Покупка успішно виконана.', receiptNumber });
    }
  });
});


app.get('/purchaseHistory/:id', requireAuthentication, (req, res) => {
  const userId = req.params.id;

  const purchaseHistoryQuery = 'SELECT purchase_date, product_id FROM purchase_history WHERE user_id = ?';
  const purchaseHistoryValues = [userId];

  connection.query(purchaseHistoryQuery, purchaseHistoryValues, (error, results) => {
    if (error) {
      console.error('Помилка під час виконання запиту до бази даних:', error);
      res.status(500).send('Помилка при отриманні історії покупок');
      return;
    }

    res.json(results);
  });
});

app.post('/checkout', requireAuthentication, (req, res) => {
  const userId = req.headers.userid;
  const { email, phone, cardNumber, expiryDate, cvv, cardType, totalPrice } = req.body;

  const clearCartItemsQuery = 'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)';
  const clearCartItemsValues = [userId];

  connection.query(clearCartItemsQuery, clearCartItemsValues, (error) => {
    if (error) {
      console.error('Помилка при очищенні cart_items:', error);
      res.status(500).send('Помилка під час обробки платежу');
      return;
    }

    // Создаем запись в purchase_history
    const createPurchaseQuery = 'INSERT INTO purchase_history (user_id, product_id, purchase_date, status) SELECT c.user_id, ci.product_id, NOW(), "Створено" FROM cart_items ci JOIN carts c ON ci.cart_id = c.id WHERE c.user_id = ?';
    const createPurchaseValues = [userId];


    connection.query(createPurchaseQuery, createPurchaseValues, (error) => {
      if (error) {
        console.error('Помилка під час створення запису в purchase_history:', error);
        res.status(500).send('Помилка під час обробки платежу');
        return;
      }

      res.sendStatus(200);
    });
  });
});


module.exports = {
  app: app,
  connection: connection
};