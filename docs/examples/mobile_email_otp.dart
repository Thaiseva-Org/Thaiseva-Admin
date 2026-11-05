import 'package:cloud_functions/cloud_functions.dart';

/// OTP API only. Signup and authentication belong to the consuming app.
class EmailOtpApi {
  EmailOtpApi({FirebaseFunctions? functions})
      : _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'asia-east2');

  final FirebaseFunctions _functions;

  Future<Map<String, dynamic>> _call(
    String name,
    Map<String, dynamic> data,
  ) async {
    final result = await _functions.httpsCallable(name).call(data);
    return Map<String, dynamic>.from(result.data as Map);
  }

  Future<Map<String, dynamic>> send(String email) =>
      _call('sendEmailOtp', {'email': email});

  Future<Map<String, dynamic>> resend({
    required String email,
    required String challengeId,
  }) =>
      _call('resendEmailOtp', {
        'email': email,
        'challengeId': challengeId,
      });

  Future<Map<String, dynamic>> verify({
    required String email,
    required String challengeId,
    required String code,
  }) =>
      _call('verifyEmailOtp', {
        'email': email,
        'challengeId': challengeId,
        'code': code,
      });
}
