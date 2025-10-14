import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, Clipboard } from 'react-native';
import { OtplessHeadlessModule } from 'otpless-headless-rn';

export default function HeadlessPage() {
    const headlessModule = new OtplessHeadlessModule();
    const [result, setResult] = useState('');
    const [form, setForm] = useState({
        phoneNumber: '',
        countryCode: '91',
        otp: '',
        channelType: '',
        email: '',
        otpLength: '',
        expiry: '',
        deliveryChannel: '',
        tid: '',
    });

    useEffect(() => {
        headlessModule.initialize("BL7SLBELGJFMQGVLXHRH")
        headlessModule.setDevLogging(true)
        headlessModule.setResponseCallback(onHeadlessResult);

        return () => {
            headlessModule.clearListener();
        };
    }, []);

    const handleChange = (fieldName: string, value: string) => {
        setForm((prevForm) => ({
            ...prevForm,
            [fieldName]: value,
        }));
    };

    const startHeadless = async () => {
        let isSdkReady = await headlessModule.isSdkReady();
        if(!isSdkReady) {
            setResult("sdk is not ready");
            return;
        }
        console.log("<<<<<SDK is READY>>>>>");
        let headlessRequest: any = {};
        const { phoneNumber, countryCode, otp, channelType, email, expiry, otpLength, deliveryChannel, tid } = form;

        if (phoneNumber) {
            headlessRequest = {
                phone: phoneNumber,
                countryCode: countryCode,
                expiry,
                otpLength,
                deliveryChannel
            };
            if (otp) {
                headlessRequest.otp = otp;
            }
        } else if (email) {
            headlessRequest = {
                email,
                expiry,
                otpLength,
                deliveryChannel
            };
            if (otp) {
                headlessRequest.otp = otp;
            }
        } else if (channelType) {
            headlessRequest = { channelType };
        }

        if (tid) {
            headlessRequest.tid = tid;
        }

        headlessModule.start(headlessRequest);
    };

    const onHeadlessResult = (data: any) => {
        if (data.responseType === 'SDK_READY' && data.statusCode == 200) {
            headlessModule.initTrueCaller({
                scope: ['open_id', "phone", 'profile']
            }).then(result => {
                console.log("result of truecaller: " + result);
            });
            
        }
        const dataStr = JSON.stringify(data);
        setResult(dataStr);
        headlessModule.commitResponse(data);
        if (data.responseType == "OTP_AUTO_READ") {
            setForm((prevForm) => ({
                ...prevForm,
                otp: data.response.otp
            }));
        }
    };

    const copyToClipboard = () => {
        Clipboard.setString(result);
    };

    const cleanupAndReinitialize = () => {
        headlessModule.cleanup();
        headlessModule.initialize("OD6F3SJGCP93605DA5OM");
        headlessModule.setResponseCallback(onHeadlessResult);
    }

    return (
        <ScrollView >
            <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Phone Number"
                placeholderTextColor="#999"
                value={form.phoneNumber}
                onChangeText={(text) => handleChange('phoneNumber', text)}
                keyboardType="phone-pad"
            />
            <View style={styles.row}>
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Country Code"
                    placeholderTextColor="#999"
                    value={form.countryCode}
                    onChangeText={(text) => handleChange('countryCode', text)}
                    keyboardType="phone-pad"
                />

                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="OTP Length"
                    placeholderTextColor="#999"
                    value={form.otpLength}
                    onChangeText={(text) => handleChange('otpLength', text)}
                    keyboardType="numeric"
                />
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Expiry"
                    placeholderTextColor="#999"
                    value={form.expiry}
                    onChangeText={(text) => handleChange('expiry', text)}
                    keyboardType="numeric"
                />
            </View>

            <TextInput
                style={styles.input}
                placeholder="Enter email"
                placeholderTextColor="#999"
                value={form.email}
                onChangeText={(text) => handleChange('email', text)}
            />

            <View style={styles.row}>

                <TextInput
                    style={styles.input}
                    placeholder="Enter OTP"
                    placeholderTextColor="#999"
                    value={form.otp}
                    onChangeText={(text) => handleChange('otp', text)}
                    keyboardType="phone-pad"
                />

                <TextInput
                    style={styles.input}
                    placeholder="Enter TID"
                    placeholderTextColor="#999"
                    value={form.tid}
                    onChangeText={(text) => handleChange('tid', text)}
                />
            </View>

            <View style={styles.row}>
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Enter SSO Channel"
                    placeholderTextColor="#999"
                    value={form.channelType}
                    onChangeText={(text) => handleChange('channelType', text.toUpperCase())}
                />
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Delivery Channel"
                    placeholderTextColor="#999"
                    value={form.deliveryChannel}
                    onChangeText={(text) => handleChange('deliveryChannel', text.toUpperCase())}
                />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={startHeadless}>
                <Text style={styles.buttonText}>Start Headless</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={copyToClipboard}>
                <Text style={styles.buttonText}>Copy Result</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={cleanupAndReinitialize}>
                <Text style={styles.buttonText}>Cleanup & Re initialize</Text>
            </TouchableOpacity>

            <Text style={styles.resultText}>{result}</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 30,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        color: '#000000',
        borderRadius: 8,
        padding: 10,
        marginVertical: 10,
        marginHorizontal: 10,
        backgroundColor: '#fff',
        fontSize: 16,
    },
    primaryButton: {
        marginVertical: 10,
        backgroundColor: "#007AFF",
        padding: 10,
        borderRadius: 30,
        justifyContent: 'center',
        marginHorizontal: 10,
        alignItems: 'center'
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    resultText: {
        marginTop: 20,
        fontSize: 16,
        color: '#333',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 8,
        width: '100%',
        maxWidth: 400,
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    }
});
