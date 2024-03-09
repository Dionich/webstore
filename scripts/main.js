function isUserAuthenticated() {
  const isAuthenticated = sessionStorage.getItem('isUserAuthenticated') === 'true';
  return isAuthenticated;
}

function createFilterElement(filter) {
  const li = document.createElement('li');
  const label = document.createElement('label');
  const input = document.createElement('input');

  input.type = 'radio';
  input.name = 'filter';
  input.value = filter.id;

  label.appendChild(input);
  label.appendChild(document.createTextNode(filter.name));

  li.appendChild(label);

  return li;
}
function getFilters() {
  fetch('http://localhost:3001/api/filters')
    .then(response => response.json())
    .then(filters => {
      const filtersList = document.getElementById('filters-list');

      filters.forEach(filter => {
        const filterElement = createFilterElement(filter);
        filterElement.querySelector('input').value = filter.id;
        filterElement.addEventListener('change', () => {
          sendSortByRequest(filterElement.querySelector('input').value);
        });
        filtersList.appendChild(filterElement);
      });
    })
    .catch(error => {
      console.error('Помилка при отриманні фільтрів: ' + error);
    });
}

const priceDescRadio = document.querySelector('input[value="price_desc"]');
const priceRadio = document.querySelector('input[value="price"]');
priceDescRadio.addEventListener('change', () => {
  sendSortByRequest('price_desc');
});
priceRadio.addEventListener('change', () => {
  sendSortByRequest('price');
});

function getProducts(request) {
  const productsPerPage = 15;
  let productsArray = [];
  if (request) {
    fetch(request)
      .then(response => response.json())
      .then(data => {
        productsArray = data;
        renderProductsPage(1);
      })
      .catch(error => {
        console.error('Помилка при отриманні даних:', error);
      });
  } else {
    fetch('http://localhost:3001/api/products')
      .then(response => response.json())
      .then(data => {
        productsArray = data;
        renderProductsPage(1);
      })
      .catch(error => {
        console.error('Помилка при отриманні даних:', error);
      });
  }

  function renderProductsPage(pageNumber) {
    const productsContainer = document.querySelector('.products-container');
    productsContainer.innerHTML = '';

    const startIndex = (pageNumber - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;

    const pageProducts = productsArray.slice(startIndex, endIndex);

    pageProducts.forEach(product => {
      const productDiv = document.createElement('div');
      productDiv.className = 'product';
      productDiv.id = `product-${product.id}`;

      const image = document.createElement('img');
      image.alt = product.name;
      image.src = `http://localhost:3001/uploads/${product.image_name}`;

      const name = document.createElement('h3');
      name.innerText = product.name;

      const price = document.createElement('p');
      price.innerText = product.price + " ₴";

      const detailsButton = document.createElement('button');
      detailsButton.className = 'btn-details';
      detailsButton.innerText = 'Детальніше';
      detailsButton.addEventListener('click', () => {
        openProductModal(product)
      });

      const toCartButton = document.createElement('button');
      toCartButton.className = 'btn-toCart';
      toCartButton.innerText = 'Додати до кошика';
      toCartButton.addEventListener('click', () => {
        if (isUserAuthenticated()) {
          addToCart(product.id);
        } else {
          const registrationOverlay = document.getElementById("registration-overlay");
          if (registrationOverlay.style.display != "block") {
            registrationOverlay.style.display = "block";
          }
        }
      });

      productDiv.appendChild(image);
      productDiv.appendChild(name);
      productDiv.appendChild(price);
      productDiv.appendChild(detailsButton);
      productDiv.appendChild(toCartButton);

      productsContainer.appendChild(productDiv);
    });
  }
}

function sendSortByRequest(sortBy) {
  const requestUrl = `http://localhost:3001/api/products/sort?sortBy=${sortBy}`;
  getProducts(requestUrl);
}

let modalContainer = null;

function openProductModal(product) {
  if (modalContainer && modalContainer.parentNode === document.body) {
    document.body.removeChild(modalContainer);
    modalContainer = null;
  }

  modalContainer = document.createElement('div');
  modalContainer.className = 'modal-container';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  const closeButton = document.createElement('button');
  closeButton.className = 'modal-close';
  closeButton.innerText = 'Закрити';

  const productDetails = document.createElement('div');
  productDetails.className = 'product-details';

  const productImageContainer = document.createElement('div');
  productImageContainer.className = 'product-image-container';

  const productImage = document.createElement('img');
  productImage.src = `http://localhost:3001/uploads/${product.image_name}`;
  productImage.alt = product.name;
  productImage.className = 'product-image';

  const productDescription = document.createElement('div');
  productDescription.className = 'product-description';

  const productName = document.createElement('h2');
  productName.innerText = product.name;

  const productText = document.createElement('p');
  productText.innerText = product.description;

  const toCartButton = document.createElement('button');
  toCartButton.className = 'modal-btn-toCart';
  toCartButton.innerText = 'Додати до кошика';
  toCartButton.addEventListener('click', () => {
    if (isUserAuthenticated()) {
      addToCart(product.id);
    } else {
      const registrationOverlay = document.getElementById("registration-overlay");
      registrationOverlay.style.display = "block";
      document.body.removeChild(modalContainer);
      modalContainer = null;
    }
  });

  productDescription.appendChild(productName);
  productDescription.appendChild(productText);
  productDescription.appendChild(toCartButton);

  productImageContainer.appendChild(productImage);
  productDetails.appendChild(productImageContainer);
  productDetails.appendChild(productDescription);

  modalContent.appendChild(closeButton);
  modalContent.appendChild(productDetails);

  modalContainer.appendChild(modalContent);

  document.body.appendChild(modalContainer);

  closeButton.addEventListener('click', () => {
    document.body.removeChild(modalContainer);
    modalContainer = null;
  });
}

async function showCartItems() {
  const itemList = document.querySelector('.item-list');
  const totalElement = document.querySelector('.total');

  const userId = sessionStorage.getItem('userId');
  const request = new XMLHttpRequest();
  request.open('GET', 'http://localhost:3001/cartItems');
  request.setRequestHeader('Content-Type', 'application/json');
  request.setRequestHeader('userId', userId);

  request.onload = async function () {
    if (request.status === 200) {
      const data = JSON.parse(request.responseText);

      if (data.length === 0) {
        itemList.innerHTML = '';
        const emptyCartMessage = document.createElement('p');
        emptyCartMessage.classList.add('cartMessage')
        emptyCartMessage.textContent = 'Кошик порожній';
        itemList.appendChild(emptyCartMessage);
        const buyButton = document.getElementById('buyButton');
        buyButton.style.display = 'none';
        totalElement.textContent = '';
      } else {
        const buyButton = document.getElementById('buyButton');
        buyButton.style.display = 'block';

        const emptyCartMessage = document.querySelector('.cartMessage');
        if (emptyCartMessage) {
          emptyCartMessage.remove();
        }


        // Create a promise to get product data by its ID
        function getProductPromise(productId) {
          return new Promise((resolve, reject) => {
            getProductData(productId, resolve);
          });
        }

        const existingItems = Array.from(itemList.querySelectorAll('.cart-item'));

        for (const item of data) {
          const existingItem = existingItems.find(
            (el) => el.dataset.itemId === item.id.toString()
          );

          if (existingItem) {
            // Item already exists in the list, skip it
            continue;
          }

          const cartItem = document.createElement('div');
          cartItem.classList.add('cart-item');
          cartItem.dataset.itemId = item.id;

          // Получение информации о товаре по его ID
          try {
            const productData = await getProductPromise(item.product_id);
            const name = document.createElement('span');
            name.classList.add('name');
            name.textContent = productData.name;
            cartItem.appendChild(name);


            const price = document.createElement('div');
            price.classList.add('price');
            price.textContent = 'Ціна: ' + productData.price + ' ₴.';
            cartItem.appendChild(price);

          } catch (error) {
            console.error('Помилка при отриманні інформації про товар:', error);
          }

          const deleteButton = document.createElement('button');
          deleteButton.classList.add('delete-button');
          deleteButton.textContent = 'Видалити';
          // Добавление обработчика события клика для кнопки удаления
          deleteButton.addEventListener('click', function () {
            deleteCartItem(item.id);
            itemList.removeChild(cartItem);
            calculateTotalPrice();
          });
          cartItem.appendChild(deleteButton);
          itemList.appendChild(cartItem);
        }

        // Remove deleted items from the list
        existingItems.forEach((existingItem) => {
          const existingItemId = parseInt(existingItem.dataset.itemId);
          const itemExists = data.some((item) => item.id === existingItemId);
          if (!itemExists) {
            itemList.removeChild(existingItem);
          }
        });

        calculateTotalPrice();
      }

    } else {
      itemList.innerHTML = '<p>Помилка під час завантаження кошика товарів</p>';
      console.error('Помилка під час виконання запиту:', request.status);
    }
  };

  request.onerror = function () {
    itemList.innerHTML = '<p>Помилка під час завантаження кошика товарів</p>';
    console.error('Помилка під час виконання запиту');
  };

  request.send();
}



function updateCartDisplay() {
  showCartItems();
}


async function addToCart(productId) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'http://localhost:3001/addToCart');
  const userId = sessionStorage.getItem('userId');
  const requestBody = JSON.stringify({ productId, userId });

  xhr.setRequestHeader('Content-Type', 'application/json');

  xhr.onreadystatechange = async function () {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        try {
          await showCartItems(); // Ожидание завершения обновления списка товаров
        } catch (error) {
          console.error('Помилка під час оновлення списку товарів:', error);
        }
      } else {
        console.error('Помилка виконання запиту: ' + xhr.status);
      }
    }
  };

  xhr.send(requestBody);
}



if (isUserAuthenticated()) {

  function createCart() {
    const cartContainer = document.createElement('div');
    cartContainer.classList.add('cart-container');
    document.body.appendChild(cartContainer);

    const cartWrapper = document.createElement('div');
    cartWrapper.classList.add('cart-wrapper');
    cartContainer.appendChild(cartWrapper);

    const toggleCartButton = document.createElement('button');
    toggleCartButton.id = 'toggleCartButton';
    toggleCartButton.textContent = 'Відкрити кошик';
    toggleCartButton.addEventListener('click', toggleCart);
    document.body.appendChild(toggleCartButton);

    const cartElement = document.createElement('div');
    cartElement.classList.add('cart');
    cartContainer.appendChild(cartElement);

    const itemList = document.createElement('div');
    itemList.classList.add('item-list');
    cartElement.appendChild(itemList);

    const buyButton = document.createElement('button');
    buyButton.id = 'buyButton';
    buyButton.textContent = 'Придбати';
    buyButton.addEventListener('click', buyItems);
    cartElement.appendChild(buyButton);

    const totalElement = document.createElement('div'); // Элемент для отображения общей стоимости
    totalElement.classList.add('total');
    cartElement.appendChild(totalElement);

    showCartItems();
  }




  function getProductData(productId, callback) {
    const request = new XMLHttpRequest();
    request.open('GET', 'http://localhost:3001/api/products/' + productId);
    request.setRequestHeader('Content-Type', 'application/json');

    request.onload = function () {
      if (request.status === 200) {
        const productData = JSON.parse(request.responseText);
        callback(productData);
      } else {
        console.error('Помилка під час виконання запиту:', request.status);
      }
    };

    request.onerror = function () {
      console.error('Помилка під час виконання запиту');
    };

    request.send();
  }

  function deleteCartItem(cartItemId) {
    const userId = sessionStorage.getItem('userId');
    const request = new XMLHttpRequest();
    request.open('DELETE', 'http://localhost:3001/cartItems/' + cartItemId);
    request.setRequestHeader('Content-Type', 'application/json');
    request.setRequestHeader('userId', userId);

    request.onload = function () {
      if (request.status === 200) {
        showCartItems();
      } else {
        console.error('Помилка під час виконання запиту:', request.status);
      }
    };

    request.onerror = function () {
      console.error('Помилка під час виконання запиту');
    };

    request.send();
  }

  function calculateTotalPrice() {
    const userId = sessionStorage.getItem('userId');
    const request = new XMLHttpRequest();
    request.open('GET', 'http://localhost:3001/cartItems');
    request.setRequestHeader('Content-Type', 'application/json');
    request.setRequestHeader('userId', userId);

    request.onload = function () {
      if (request.status === 200) {
        const data = JSON.parse(request.responseText);

        let totalPrice = 0;

        // Create a promise to get product data by its ID
        function getProductPromise(productId) {
          return new Promise((resolve, reject) => {
            getProductData(productId, resolve);
          });
        }

        // Create an array to store promises for fetching product data
        const productPromises = [];

        data.forEach(function (item) {
          try {
            const productPromise = getProductPromise(item.product_id);
            productPromises.push(productPromise);
          } catch (error) {
            console.error('Помилка при отриманні інформації про товар:', error);
          }
        });

        // Wait for all product promises to resolve
        Promise.all(productPromises)
          .then((productDataArray) => {
            productDataArray.forEach(function (productData) {
              const productPrice = parseFloat(productData.price);
              totalPrice += productPrice;
            });
            const totalElement = document.querySelector('.total');
            totalElement.textContent = 'Загальна сума:' + totalPrice + ' ₴.';

          })
          .catch((error) => {
            console.error('Помилка при отриманні інформації про товар:', error);
          });
      } else {
        console.error('Помилка при завантаженні кошика товарів:', request.status);
      }
    };

    request.onerror = function () {
      console.error('Помилка під час виконання запиту');
    };

    request.send();
  }

  function buyItems() {
    const userId = sessionStorage.getItem('userId');
    window.location.href = "http://localhost:3001/payment?userId=" + userId;
  }





  function toggleCart() {
    const cartContainer = document.querySelector('.cart-container');

    if (cartContainer.style.display === 'none') {
      cartContainer.style.display = 'block';
      toggleCartButton.textContent = 'Закрити кошик';
    } else {
      cartContainer.style.display = 'none';
      toggleCartButton.textContent = 'Відкрити кошик';
    }
  }

}

document.addEventListener('DOMContentLoaded', function () {
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');

  function getMatchingProducts(searchQuery, callback) {
    axios.get('http://localhost:3001/api/products/search', {
      params: {
        query: searchQuery
      }
    })
      .then(response => {
        const products = response.data;
        callback(null, products);
      })
      .catch(error => {
        const errorMessage = 'Ошибка при выполнении запроса к серверу: ' + error.message;
        callback(errorMessage, null);
      });
  }

  function displaySearchResults(products) {
    var options = products.map(function (product) {
      return '<li>' + product.name + '</li>';
    });

    if (searchInput.value.length === 0) {
      searchResults.style.display = 'none';
    } else {
      searchResults.innerHTML = options.slice(0, 5).join('');
      searchResults.style.display = 'block';
    }
  }

  function getProductByName(productName, callback) {
    axios.get('http://localhost:3001/api/products/search', {
      params: {
        query: productName
      }
    })
      .then(response => {
        const products = response.data;
        if (products.length > 0) {
          const product = products[0];
          callback(null, product);
        } else {
          const errorMessage = 'Товар не найден';
          callback(errorMessage, null);
        }
      })
      .catch(error => {
        const errorMessage = 'Ошибка при получении данных товара: ' + error.message;
        callback(errorMessage, null);
      });
  }

  searchInput.addEventListener('input', function () {
    var searchQuery = searchInput.value;

    // Проверяем, что поле ввода не пустое
    if (searchQuery.length === 0) {
      displaySearchResults([]); // Очищаем результаты поиска
      return; // Не отправляем запрос
    }

    getMatchingProducts(searchQuery, function (error, products) {
      if (error) {
        console.error('Ошибка при выполнении запроса: ' + error);
        return;
      }

      displaySearchResults(products);
    });
  });


  searchResults.addEventListener('click', function (event) {
    var selectedProduct = event.target.textContent;
    searchInput.value = selectedProduct;
    searchResults.style.display = 'none';

    getProductByName(selectedProduct, function (error, product) {
      if (error) {
        console.error('Ошибка при получении данных товара: ' + error);
        return;
      }

      openProductModal(product);
      searchInput.value = '';
    });
  });
});





document.addEventListener('DOMContentLoaded', function () {
  getProducts();
  getFilters();
  isUserAuthenticated();
  if (isUserAuthenticated()) {
    createCart();
    toggleCart();
  }
});


