import { Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  headerContainer: {
    marginTop: 15,
    marginBottom: 15,
    padding: "0 15px",
  },
  paymentTo: {
    // marginTop: 15,
    marginBottom: 2,
    fontWeight: "bold",
    // fontFamily: "Helvetica-Oblique",
  },
});

const PaymentTo = ({ paymentTo }) => (
  <View style={styles.headerContainer}>
    {/* <Text style={styles.paymentTo}>Payment To:</Text> */}
    <Text style={styles.paymentTo}>Bill To:</Text>
    <Text>{paymentTo?.partnerName}</Text>
    {/* <Text>{paymentTo?.partnerAddress}</Text> */}
    <Text>{paymentTo?.partnerPhone}</Text>
    {/* <Text>{paymentTo?.partnerEmail}</Text> */}
  </View>
);

export default PaymentTo;
