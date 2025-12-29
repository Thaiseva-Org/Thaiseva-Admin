import { Fragment } from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";
import { dateCalculator } from "../../utils/utils";

const styles = StyleSheet.create({
  invoiceNoContainer: {
    flexDirection: "row",
    marginTop: 15,
    justifyContent: "flex-end",
  },
  invoiceDateContainer: {
    flexDirection: "row",
    marginRight: 15,
    justifyContent: "flex-end",
  },
  invoiceDate: {
    fontSize: 12,
    fontWeight: "bold",
  },
  label: {
    // width: 60,
  },
});

const InvoiceNo = ({ paymentDate, invoiceDate, invoiceId }) => (
  <Fragment>
    {invoiceId && (
      <View style={styles.invoiceDateContainer}>
        <Text style={styles.label}>Invoice No : </Text>
        <Text>{invoiceId}</Text>
      </View>
    )}
    <View style={styles.invoiceDateContainer}>
      <Text style={styles.label}>Booking Date : </Text>
      <Text>{paymentDate}</Text>
    </View>
    <View style={styles.invoiceDateContainer}>
      <Text style={styles.label}>Invoice Date : </Text>
      {/* <Text>{dateCalculator(invoiceDate)}</Text> */}
      <Text>{invoiceDate}</Text>
    </View>
  </Fragment>
);

export default InvoiceNo;
