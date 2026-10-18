// Integration example; add cloud_functions, firebase_storage and uuid to the mobile app.
// Firebase must already be initialized and the customer signed in.
import 'dart:convert';
import 'dart:typed_data';
import 'dart:io';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:uuid/uuid.dart';

class CustomerChatService {
  final HttpsCallable _endpoint = FirebaseFunctions.instanceFor(
    region: 'asia-east2',
  ).httpsCallable('customerChat');

  Future<Map<String, dynamic>> call(String action,
      [Map<String, dynamic> payload = const {}]) async {
    final result = await _endpoint.call({...payload, 'action': action});
    return Map<String, dynamic>.from(result.data as Map);
  }

  Future<Map<String, dynamic>> open() => call('open');

  Future<Map<String, dynamic>> messages({String? cursor}) => call(
        'messages', {'limit': 30, if (cursor != null) 'cursor': cursor});

  Future<Map<String, dynamic>> bookings(String service, {String? cursor}) =>
      call('bookings', {'service': service, if (cursor != null) 'cursor': cursor});

  // Persist this exact map before the first send. Reuse it unchanged on retries.
  Map<String, dynamic> prepareMessage({
    String text = '',
    Map<String, dynamic>? booking,
    String? attachmentId,
    String? replyTo,
  }) => {
        'requestId': const Uuid().v4(),
        'text': text,
        if (booking != null)
          'booking': {'service': booking['service'], 'id': booking['id']},
        if (attachmentId != null) 'attachmentId': attachmentId,
        if (replyTo != null) 'replyTo': replyTo,
      };

  Future<Map<String, dynamic>> sendPrepared(Map<String, dynamic> payload) =>
      call('send', payload);

  Future<Map<String, dynamic>> upload({
    required String name,
    required String contentType,
    required Uint8List bytes,
  }) {
    if (bytes.length > 8 * 1024 * 1024) {
      throw ArgumentError('Maximum attachment size is 8 MiB.');
    }
    return call('upload', {
      'name': name,
      'contentType': contentType,
      'contentBase64': base64Encode(bytes),
    });
  }

  Future<Uint8List> download(String attachmentId) async {
    final result = await call('download', {'attachmentId': attachmentId});
    if (result['downloadTransport'] == 'firebase-authenticated') {
      throw StateError('Use downloadToFile for large historical attachments.');
    }
    return base64Decode(result['contentBase64'] as String);
  }

  // Native Flutter example; web clients can use the Storage SDK's getBlob/getData.
  Future<File> downloadToFile(String attachmentId, File destination) async {
    final result = await call('download', {'attachmentId': attachmentId});
    if (result['downloadTransport'] == 'firebase-authenticated') {
      final storage = FirebaseStorage.instanceFor(
        app: Firebase.app(), bucket: 'gs://${result['bucket']}',
      );
      await storage.ref(result['storagePath'] as String).writeToFile(destination);
    } else {
      await destination.writeAsBytes(base64Decode(result['contentBase64'] as String));
    }
    return destination;
  }

  Future<Map<String, dynamic>> markRead(int newestDisplayedTimestamp) =>
      call('read', {'through': newestDisplayedTimestamp});

  Future<Map<String, dynamic>> search(String query, {String? cursor}) =>
      call('search', {'query': query, if (cursor != null) 'cursor': cursor});

  Future<Map<String, dynamic>> shared(String category, {String? cursor}) =>
      call('shared', {'category': category, if (cursor != null) 'cursor': cursor});
}

// Usage:
// final chat = CustomerChatService();
// await chat.open();
// final page = await chat.bookings('hotel');
// final chosen = Map<String, dynamic>.from(page['items'].first as Map);
// final pending = chat.prepareMessage(text: 'Can I change check-in?', booking: chosen);
// await pendingStore.save(pending); // Your app's private local persistence.
// await chat.sendPrepared(pending);
// await pendingStore.remove(pending['requestId']);
// Catch FirebaseFunctionsException; use its code and message for error handling.
// Only one visible-screen polling request should run at a time. Cancel polling
// when backgrounded/disposed. Do not automatically retry permission errors.
