'use strict';

var conf = require('simple-configure');
var logger = require('winston').loggers.get('transactions');
var jade = require('jade');
var path = require('path');
var _ = require('lodash');

var beans = conf.get('beans');
var notifications = beans.get('notifications');
var memberstore = beans.get('memberstore');
var membersService = beans.get('socratesMembersService');
var subscriberstore = beans.get('subscriberstore');
var subscriberService = beans.get('subscriberService');
var socratesConstants = beans.get('socratesConstants');

function renderingOptions(member) {
  return {
    pretty: true,
    member: member,
    url: conf.get('publicUrlPrefix'),
    socratesConstants: socratesConstants
  };
}

function notifyConcernedParties(member, bookingdetails, participantFilename, participantSubject, organizersFilename, organizersSubject) {
  /*eslint no-underscore-dangle: 0*/

  var options = renderingOptions(member);
  options.bookingdetails = bookingdetails;
  var filename = path.join(__dirname, 'jade/' + participantFilename + '.jade');
  notifications._sendMail([member.email()], participantSubject, jade.renderFile(filename, options));
  membersService.registrationNotificationEmailAddresses(function (err, receivers) {
    if (err || !receivers) { return logger.error(err); }
    var file = path.join(__dirname, 'jade/' + organizersFilename + '.jade');
    notifications._sendMail(receivers, organizersSubject, jade.renderFile(file, options));
  });
}
module.exports = {
  newSoCraTesMemberRegistered: function (member) {
    membersService.registrationNotificationEmailAddresses(function (err, receivers) {
      if (err || !receivers) { return logger.error(err); }
      subscriberstore.allSubscribers(function (err1, subscribers) {
        if (err1 || !subscribers) { return logger.error(err1); }
        var options = renderingOptions(member);
        options.count = subscribers.length;
        var filename = path.join(__dirname, 'jade/newmembertemplate.jade');
        notifications._sendMail(receivers, 'Neuer Interessent', jade.renderFile(filename, options));
      });
    });
  },

  newParticipant: function (memberID, bookingdetails) {
    memberstore.getMemberForId(memberID, function (err, member) {
      if (err || !member) { return logger.error(err); }
      notifyConcernedParties(member, bookingdetails, 'registrationConfirmation', 'SoCraTes Registration Confirmation',
        'superuserRegistrationNotification', 'New SoCraTes Registration');
    });
  },

  changedDuration: function (member, bookingdetails) {
    notifyConcernedParties(member, bookingdetails, 'changedRegistration', 'SoCraTes Change of Length of Stay',
      'superuserRegistrationNotification', 'Change in SoCraTes Registration - Duration');
  },

  changedResource: function (member, bookingdetails) {
    notifyConcernedParties(member, bookingdetails, 'changedRegistration', 'SoCraTes Change of Room Option',
      'superuserRegistrationNotification', 'Change in SoCraTes Registration - Resource');
  },

  changedWaitinglist: function (member, bookingdetails) {
    notifyConcernedParties(member, bookingdetails, 'changedWaitinglist', 'SoCraTes Waitinglist Change of Room Option',
      'superuserWaitinglistNotification', 'Change in SoCraTes Waitinglist - Resource');
  },

  removedFromParticipants: function (member) {
    notifyConcernedParties(member, {resourceKind: 'participant list'}, 'removalNotification', 'SoCraTes - Removal from Participant List',
      'superuserRemovalNotification', 'Change in SoCraTes Registration - Removal from Participants');
  },

  removedFromWaitinglist: function (member) {
    notifyConcernedParties(member, {resourceKind: 'waitinglist'}, 'removalNotification', 'SoCraTes - Removal from Waitinglist',
      'superuserRemovalNotification', 'Change in SoCraTes Registration - Removal from Waitinglist');
  },

  newWaitinglistEntry: function (memberID, bookingdetails) {
    memberstore.getMemberForId(memberID, function (err, member) {
      if (err || !member) { return logger.error(err); }
      notifyConcernedParties(member, bookingdetails, 'waitinglistConfirmation', 'SoCraTes Waitinglist Confirmation',
        'superuserWaitinglistNotification', 'New SoCraTes Waitinglist Entry');
    });
  },

  wikiChanges: function (changes, callback) {
    var options = {
      directories: _.sortBy(changes, 'dir')
    };
    _.defaults(options, renderingOptions());
    subscriberService.emailAddressesForWikiNotifications(function (err1, emails) {
      if (err1 || emails.length === 0) { return callback(err1); }
      var filename = path.join(__dirname, 'jade/wikichangetemplate.jade');
      notifications._sendMail(emails, 'SoCraTes Wiki Changes', jade.renderFile(filename, options), callback);
    });
  }

};
