'use strict';

var beans = require('simple-configure').get('beans');

var misc = beans.get('misc');
var paymentService = beans.get('paymentService');
var statusmessage = beans.get('statusmessage');
var fieldHelpers = beans.get('fieldHelpers');
var socratesConstants = beans.get('socratesConstants');
var subscriberstore = beans.get('subscriberstore');

var app = misc.expressAppIn(__dirname);

app.get('/', function (req, res, next) {
  paymentService.getPaymentInfo(function (err, paymentInfo) {
    if (err || !paymentInfo) { return next(err); }
    res.render('index', {
      paymentInfo: paymentInfo,
      placeholder: fieldHelpers.formatNumberWithCurrentLocale(res, 0)
    });
  });
});

app.get('/socrates', function (req, res, next) {
  paymentService.getPaymentInfo(function (err, paymentInfo) {
    if (err || !paymentInfo) { return next(err); }
    subscriberstore.getSubscriber(req.user.member.id(), function (err, subscriber) {
      if (err || !subscriber) { return next(err); }
      res.render('index', {
        amount: socratesConstants.depositAmount,
        title: 'SoCraTes-' + socratesConstants.currentYear,
        fee: fieldHelpers.formatNumberWithCurrentLocale(res, paymentService.calcFee(socratesConstants.depositAmount)),
        paymentInfo: paymentInfo,
        paymentDone: subscriber.payment().paymentDone()
      });
    });
  });
});

app.get('/calcFee/:amount', function (req, res) {
  var amount = fieldHelpers.parseNumberWithCurrentLocale(res.locals.language, req.params.amount);
  if (!amount) { return res.end(''); }
  res.end(fieldHelpers.formatNumberWithCurrentLocale(res, paymentService.calcFee(amount)) + ' €');
});

app.get('/calcFee', function (req, res) {
  return res.end('');
});

app.post('/submitCreditCard', function (req, res, next) {
  var saveCreditCardPayment = function (callback) { callback(null); };
  paymentService.payWithCreditCard(saveCreditCardPayment, parseFloat(req.body.amount.replace(',', '.')), req.body.description, req.user.member.id(),
    req.body.stripeId, function (err, message) {
      if (err) { return next(err); }
      message.putIntoSession(req);
      res.redirect('/');
    });
});

app.post('/submitCreditCardSocrates', function (req, res, next) {
  var saveCreditCardPayment = function (callback) {
    subscriberstore.getSubscriber(req.user.member.id(), function (err, subscriber) {
      if (err) { return callback(err); }
      subscriber.payment().noteCreditCardPayment();
      subscriberstore.saveSubscriber(subscriber, callback);
    });
  };
  paymentService.payWithCreditCard(saveCreditCardPayment, parseFloat(req.body.amount.replace(',', '.')), req.body.description, req.user.member.id(),
    req.body.stripeId, function (err, message) {
      if (err) { return next(err); }
      message.putIntoSession(req);
      res.redirect('/');
    });
});

module.exports = app;
