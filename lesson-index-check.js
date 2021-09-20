// to be used on beyond photography website
$('.container .row').each((index, ele) => {
    ele.append(`<span>${index - 1}</span>`);
});
