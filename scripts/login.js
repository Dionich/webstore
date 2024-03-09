function isUserAuthenticated() {
  const isAuthenticated = sessionStorage.getItem('isUserAuthenticated') === 'true';
  if (isAuthenticated) {
    const avatarUrl = sessionStorage.getItem('avatarUrl');
    accountImage.src = avatarUrl;
  }

  return isAuthenticated;
}

const openFormButton = document.getElementById("account-button");
const closeFormButton = document.getElementById("close-form-btn");
const registrationOverlay = document.getElementById("registration-overlay");
const registerForm = document.getElementById("register-form");
const loginForm = document.getElementById("login-form");
const registerToggle = document.getElementById("register-toggle");
const loginToggle = document.getElementById("login-toggle");
const accountImage = document.getElementById("account-image");

const openFormButtonClickHandler = function (event) {
  event.preventDefault();

  if (registrationOverlay.style.display != "block") {
    registrationOverlay.style.display = "block";
  }
};
openFormButton.addEventListener("click", openFormButtonClickHandler);

closeFormButton.addEventListener("click", function () {
  if (registrationOverlay.style.display != "none") {
    registrationOverlay.style.display = "none";
  }
});


registerForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const username = registerForm.elements.username.value;
  const email = registerForm.elements.email.value;
  const password = registerForm.elements.password.value;

  const registerErrorElements = registerForm.querySelectorAll(".errorReg");
  registerErrorElements.forEach((element) => {
    element.textContent = "";
  });

  if (!username || !email || !password) {
    showRegError("Заповніть всі поля");
    return;
  }

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "http://localhost:3001/register");

  const formData = new FormData();
  formData.append("username", username);
  formData.append("email", email);
  formData.append("password", password);

  xhr.onreadystatechange = function () {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        const successMessage = document.getElementById("successMessage");
        successMessage.style.display = "block";
      } else {
        const response = JSON.parse(xhr.responseText);
        showRegError(response.error);
        console.error("Помилка виконання запиту: " + xhr.status);
      }
    }
  };

  xhr.send(formData);
  registerForm.reset();
});
loginForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const username = loginForm.elements.username.value;
  const password = loginForm.elements.password.value;

  if (!username || !password) {
    showLogError("Заповніть всі поля");
    return;
  }

  if (username.length > 30) {
    showLogError("Занадто довгий логін");
    return;
  }

  if (password.length < 4) {
    showLogError("Занадто короткий пароль");
    return;
  }

  try {
    const response = await fetch("http://localhost:3001/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.isAdmin) {
        window.open("http://localhost:3001/admin", "_blank");
        registrationOverlay.style.display = "none";
      } else if (data.isUserAuthenticated) {
        const userId = data.userId;
        sessionStorage.setItem('isUserAuthenticated', 'true');
        sessionStorage.setItem('username', username);
        sessionStorage.setItem('userId', userId);
        const isAuthenticated = isUserAuthenticated();
        registrationOverlay.style.display = "none";
        userFunction(isAuthenticated)
        window.location.reload();
      }
    } else if (response.status === 401) {
      const errorData = await response.json();
      showLogError("Помилка авторизації: " + errorData.message);
      console.error("Помилка авторизації: " + errorData.message);
    } else {
      console.error("Помилка виконання запиту: " + response.status);
    }
  } catch (error) {
    console.error("Помилка виконання запиту: " + error);
  }

  loginForm.reset();
});

function generateAvatarUrl(username) {
  const initial = (username && username.charAt(0).toUpperCase()) || '';
  const randomColorText = Math.floor(Math.random() * 16777215).toString(16);
  const randomColorBackground = Math.floor(Math.random() * 16777215).toString(16);
  const avatarUrl = `https://via.placeholder.com/150/${randomColorBackground}/${randomColorText}?text=${initial}`;

  return avatarUrl;
}

function userFunction(isAuthenticated) {
  if (isAuthenticated) {
    const username = sessionStorage.getItem('username');
    const avatarUrl = generateAvatarUrl(username);
    accountImage.src = avatarUrl;
    sessionStorage.setItem('avatarUrl', avatarUrl);
    registrationOverlay.style.display = "none";
    openFormButton.removeEventListener("click", openFormButtonClickHandler);
    let containerCreated = false;
    openFormButton.addEventListener("click", function (event) {
      event.preventDefault();

      if (!containerCreated) {
        const parentElement = accountImage.parentElement;

        const listItems = `
          <li><a href="#" id="purchase_history">Історія покупок</a></li>
          <li><a href="#" id="account_exit">Вийти з облікового запису</a></li>
        `;

        const listContainer = document.createElement('div');
        listContainer.classList.add('list-container');
        listContainer.innerHTML = `<ul>${listItems}</ul>`;


        listContainer.addEventListener('click', function (event) {
          if (event.target.id === 'purchase_history') {
            loadPurchaseHistory();
          }
        });

        parentElement.insertBefore(listContainer, accountImage.nextSibling);
        const accountExitButton = document.getElementById("account_exit");

        if (accountExitButton) {
          accountExitButton.addEventListener("click", function (event) {
            event.preventDefault();

            const xhr = new XMLHttpRequest();
            xhr.open("POST", "http://localhost:3001/logout");

            xhr.onload = function () {
              if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                  sessionStorage.setItem('isUserAuthenticated', 'false');
                  sessionStorage.removeItem('username');
                  sessionStorage.removeItem('avatarUrl');
                  window.location.reload();
                } else {
                  console.error("Помилка виконання запиту: " + xhr.status);
                }
              }
            };

            xhr.send();
          });
        }

        containerCreated = true;
      } else if (containerCreated) {
        const listContainer = accountImage.nextElementSibling;
        listContainer.remove();
        containerCreated = false;
      }
    });
  }
}

async function loadPurchaseHistory() {
  const userId = sessionStorage.getItem('userId');
  const request = new XMLHttpRequest();
  request.open('GET', `http://localhost:3001/purchaseHistory/${userId}`);
  request.setRequestHeader('Content-Type', 'application/json');

  request.onload = async function () {
    if (request.status === 200) {
      const purchaseHistory = JSON.parse(request.responseText);
      await showPurchaseHistoryOverlay(purchaseHistory);
    } else {
      console.error('Помилка при завантаженні історії покупок:', request.status);
    }
  };

  request.onerror = function () {
    console.error('Помилка під час виконання запиту');
  };

  request.send();
}

async function showPurchaseHistoryOverlay(purchaseHistory) {
  const overlayElement = document.createElement('div');
  overlayElement.classList.add('purchase-history-overlay');

  const containerElement = document.createElement('div');
  containerElement.classList.add('purchase-history-container');

  const closeElement = document.createElement('span');
  closeElement.textContent = 'Закрити';
  closeElement.classList.add('purchase-history-close');
  closeElement.addEventListener('click', hidePurchaseHistoryOverlay);

  containerElement.appendChild(closeElement);

  const purchaseHistoryTable = document.createElement('table');
  purchaseHistoryTable.classList.add('purchase-history-table');

  const tableHeader = document.createElement('tr');
  const headerColumns = ['Дата купівлі', 'Товар', 'Ціна'];
  headerColumns.forEach((columnText) => {
    const headerColumn = document.createElement('th');
    headerColumn.textContent = columnText;
    tableHeader.appendChild(headerColumn);
  });
  purchaseHistoryTable.appendChild(tableHeader);

  for (const purchase of purchaseHistory) {
    const tableRow = document.createElement('tr');

    const purchaseDateColumn = document.createElement('td');
    purchaseDateColumn.textContent = purchase.purchase_date;
    tableRow.appendChild(purchaseDateColumn);

    const productColumn = document.createElement('td');
    const productName = await getProductById(purchase.product_id);
    productColumn.textContent = productName;
    tableRow.appendChild(productColumn);

    const priceColumn = document.createElement('td');
    const productPrice = await getProductPriceById(purchase.product_id);
    priceColumn.textContent = productPrice + ' ₴.';
    tableRow.appendChild(priceColumn);

    purchaseHistoryTable.appendChild(tableRow);
  }

  containerElement.appendChild(purchaseHistoryTable);

  overlayElement.appendChild(containerElement);

  document.body.appendChild(overlayElement);

  document.body.style.overflow = 'hidden';
}

async function getProductById(productId) {
  const request = new XMLHttpRequest();
  request.open('GET', `http://localhost:3001/api/products/${productId}`);
  request.setRequestHeader('Content-Type', 'application/json');

  return new Promise((resolve, reject) => {
    request.onload = function () {
      if (request.status === 200) {
        const product = JSON.parse(request.responseText);
        resolve(product.name);
      } else {
        reject('Помилка при завантаженні продукту');
      }
    };

    request.onerror = function () {
      reject('Помилка під час виконання запиту');
    };

    request.send();
  });
}

async function getProductPriceById(productId) {
  const request = new XMLHttpRequest();
  request.open('GET', `http://localhost:3001/api/products/${productId}`);
  request.setRequestHeader('Content-Type', 'application/json');

  return new Promise((resolve, reject) => {
    request.onload = function () {
      if (request.status === 200) {
        const product = JSON.parse(request.responseText);
        resolve(product.price);
      } else {
        reject('Помилка завантаження ціни продукту');
      }
    };

    request.onerror = function () {
      reject('Помилка під час виконання запиту');
    };

    request.send();
  });
}

function hidePurchaseHistoryOverlay() {
  const overlayElement = document.querySelector('.purchase-history-overlay');
  overlayElement.remove();

  document.body.style.overflow = 'auto';
}

function displayPurchaseHistory(purchaseHistory) {
  const purchaseHistoryTable = document.createElement('table');
  purchaseHistoryTable.classList.add('purchase-history-table');

  // Создание заголовка таблицы
  const tableHeader = document.createElement('tr');
  const headerColumns = ['Дата купівлі', 'Товар', 'Ціна'];
  headerColumns.forEach((columnText) => {
    const headerColumn = document.createElement('th');
    headerColumn.textContent = columnText;
    tableHeader.appendChild(headerColumn);
  });
  purchaseHistoryTable.appendChild(tableHeader);

  purchaseHistory.forEach((purchase) => {
    const tableRow = document.createElement('tr');

    const purchaseDateColumn = document.createElement('td');
    purchaseDateColumn.textContent = purchase.purchase_date;
    tableRow.appendChild(purchaseDateColumn);

    const productColumn = document.createElement('td');
    productColumn.textContent = purchase.product_name;
    tableRow.appendChild(productColumn);

    const priceColumn = document.createElement('td');
    priceColumn.textContent = purchase.price + ' ₴.';
    tableRow.appendChild(priceColumn);

    purchaseHistoryTable.appendChild(tableRow);
  });

  const purchaseHistoryElement = document.querySelector('.purchase-history');
  purchaseHistoryElement.innerHTML = '';
  purchaseHistoryElement.appendChild(purchaseHistoryTable);
}



function showRegError(message) {
  const regErrorElement = document.getElementById("errorReg");
  regErrorElement.textContent = message;
}

function showLogError(message) {
  const loginErrorElement = document.getElementById("errorLog");
  loginErrorElement.textContent = message;
}

window.addEventListener('load', function () {
  const isAuthenticated = isUserAuthenticated();
  userFunction(isAuthenticated);
});