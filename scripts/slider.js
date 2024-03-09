const slider = document.querySelector('.slider');
const images = slider.querySelectorAll('img');
let currentIndex = 0;
const prevButton = slider.querySelector('.prev-button');
const nextButton = slider.querySelector('.next-button');
let intervalId;

let loadedImagesCount = 0;
images.forEach(image => {
  if (image.complete) {
    loadedImagesCount++;
  } else {
    image.addEventListener('load', () => {
      loadedImagesCount++;
      if (loadedImagesCount === images.length) {
        startSliderInterval();
      }
    });
  }
});

function startSliderInterval() {
  intervalId = setInterval(() => {
    nextButton.click();
  }, 5000);
}

function resetSliderInterval() {
  clearInterval(intervalId);
  startSliderInterval();
}

startSliderInterval();

prevButton.addEventListener('click', () => {
  images[currentIndex].classList.remove('active');
  currentIndex--;
  if (currentIndex < 0) {
    currentIndex = images.length - 1;
  }
  images[currentIndex].classList.add('active');
  resetSliderInterval();
});

nextButton.addEventListener('click', () => {
  images[currentIndex].classList.remove('active');
  currentIndex++;
  if (currentIndex === images.length) {
    currentIndex = 0;
  }
  images[currentIndex].classList.add('active');
  resetSliderInterval();
});
