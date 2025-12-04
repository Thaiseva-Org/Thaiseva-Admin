import { StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  accountInfo: {
    marginTop: 20,
    flexGrow: 1,
    padding: "0 15px",
  },
  paymentTo: {
    marginTop: 10,
    marginBottom: 3,
    fontWeight: "bold",
    // fontFamily: "Helvetica-Oblique",
    borderBottom: "0.5px solid black",
  },
});

const AccountInfo = ({ bankInfo }) => (
  <View style={styles.accountInfo}>
    {/* <Text style={styles.paymentTo}> Account Info</Text> */}
    {/* <Text>Bank Name : {bankInfo?.bankName}</Text> */}
    {/* <Text>Account Name : {bankInfo?.accountNumber}</Text> */}
    {/* <Text>Account Number : {bankInfo?.accountNumber}</Text>
    <Text>Branch Address : {bankInfo?.address}</Text> */}
  </View>
);
export default AccountInfo;
