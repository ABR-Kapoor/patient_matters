import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Modal , RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Camera, ChevronRight, X, Globe, Check, LogOut } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { fetchWithAuth } from '../../lib/fetchWithAuth';
import { useAuthToken, usePatientIdentity } from '../../hooks/stubs';
import { TranslatedText } from '../../components/TranslatedText';
import { useLanguage } from '../../lib/LanguageContext';
import * as ImagePicker from 'expo-image-picker';
import { AppDatePickerModal } from '../../components/AppDatePickerModal';
import { useAuth } from '@clerk/expo';
import { useNotification } from '../../lib/NotificationContext';

const COLORS = {
  primary: '#048256',
  primaryLight: '#EDF7E3',
  text: '#030315',
  background: '#F2F1F0',
  white: '#FFFFFF',
  gray: '#9CA3AF',
  lightGray: '#E5E7EB',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
};

const FONTS = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

function formatDateOfBirth(raw: any): string {
  if (!raw) return 'Select';
  const str = String(raw).trim();
  const d = new Date(str);
  if (isNaN(d.getTime())) {
    // If it's already YYYY-MM-DD or similar string
    return str.split('T')[0];
  }
  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const TagInput = ({ tags, onChange, placeholder }: { tags: string[], onChange: (tags: string[]) => void, placeholder: string }) => {
  const [inputValue, setInputValue] = useState('');
  const handleAddTag = () => {
    const val = inputValue.trim();
    if (val && !tags.includes(val)) { onChange([...tags, val]); setInputValue(''); }
  };
  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
      <View style={styles.tagList}>
        {tags.map((tag, index) => (
          <View key={index} style={styles.tagPill}>
            <Text style={styles.tagText}>{tag}</Text>
            <TouchableOpacity onPress={() => onChange(tags.filter(t => t !== tag))} style={{ padding: 2 }}>
              <X size={12} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        ))}
        <TextInput
          style={styles.tagTextInput}
          value={inputValue}
          onChangeText={setInputValue}
          onSubmitEditing={handleAddTag}
          placeholder={tags.length === 0 ? placeholder : "Add more..."}
          placeholderTextColor={COLORS.gray}
          returnKeyType="done"
        />
      </View>
    </View>
  );
};

export default function ProfilePage() {
  const router = useRouter();
  const { signOut } = useAuth();
  const token = useAuthToken();
  const { locale, setLocale, locales, localeInfo } = useLanguage();
  const { data: identity, isLoading: isIdentityLoading } = usePatientIdentity(token);
  const uid = identity?.uid;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast, showAlert, showConfirm } = useNotification();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showBloodGroupPicker, setShowBloodGroupPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  
  const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
  const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  
  const [user, setUser] = useState<any>({});
  const [patient, setPatient] = useState<any>({ chronic_conditions: [], allergies: [], current_medications: [] });
  const [agreedTerms, setAgreedTerms] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!uid) { setLoading(false); return; }
      try {
        const response = await fetchWithAuth('/api/patient/profile', token);
        const data = await response.json();
        if (data.success) {
          setUser(data.user || {});
          const pData = data.patient || {};
          if (typeof pData.chronic_conditions === 'string') pData.chronic_conditions = JSON.parse(pData.chronic_conditions);
          if (typeof pData.allergies === 'string') pData.allergies = JSON.parse(pData.allergies);
          if (typeof pData.current_medications === 'string') pData.current_medications = JSON.parse(pData.current_medications);
          setPatient({
            ...pData,
            chronic_conditions: Array.isArray(pData.chronic_conditions) ? pData.chronic_conditions : [],
            allergies: Array.isArray(pData.allergies) ? pData.allergies : [],
            current_medications: Array.isArray(pData.current_medications) ? pData.current_medications : [],
          });
        }
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    if (!isIdentityLoading) fetchProfile();
  }, [uid, isIdentityLoading]);

  const handleSave = async () => {
    if (!agreedTerms) { showAlert('Terms Required', 'You must agree to the Terms of Service to update your record.'); return; }
    setSaving(true);
    try {
      const internalUid = user?.uid || uid;
      const response = await fetchWithAuth('/api/patient/profile', token, { method: 'PATCH', body: JSON.stringify({ uid: internalUid, user, patient }) });
      const data = await response.json();
      if (data.success) { showToast('Profile Updated', 'Your profile details have been saved successfully.'); } 
      else { showAlert('Update Failed', data.error || 'Failed to update profile'); }
    } catch (err) { showAlert('Network Error', 'Please check your connection and try again.'); } 
    finally { setSaving(false); }
  };

  const performLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/sign-in');
    } catch {
      setSigningOut(false);
    }
  };

  const handleLogout = () => {
    // Alert is a no-op on react-native-web, which would turn this into a dead
    // button there. Confirm natively, act directly on web.
    if (Platform.OS === 'web') return void performLogout();

    showConfirm('Log Out', 'Are you sure you want to log out of your account?', performLogout, 'Log Out', 'Cancel', true);
  };

  const updateUser = (field: string, value: string) => setUser({ ...user, [field]: value });
  const updatePatient = (field: string, value: any) => setPatient({ ...patient, [field]: value });

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.3, base64: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        updateUser('profile_image_url', `data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (err) { showAlert('Image Error', 'Failed to pick image from library.'); }
  };

  if (loading || isIdentityLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: 'Profile', headerStyle: { backgroundColor: COLORS.background }, headerShadowVisible: false, headerTintColor: COLORS.text, headerTitleStyle: { fontFamily: FONTS.bold } }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={async () => {
                setRefreshing(true);
                try {
                  const response = await fetchWithAuth('/api/patient/profile', token);
                  const data = await response.json();
                  if (data.success) {
                    setUser(data.user);
                    setPatient(data.patient);
                  }
                } catch (e) {
                  console.warn(e);
                } finally {
                  setRefreshing(false);
                }
              }} 
              colors={[COLORS.primary]} 
              tintColor={COLORS.primary} 
            />
          }>
          
          {/* Avatar Area */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} activeOpacity={0.8}>
              {user.profile_image_url ? (
                <Image source={{ uri: user.profile_image_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={36} color={COLORS.gray} />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Camera size={14} color={COLORS.text} />
              </View>
            </TouchableOpacity>
            <Text style={styles.userName}>{user.name || 'Patient'}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>

          {/* Group: Personal */}
          <Text style={styles.groupHeader}><TranslatedText>PERSONAL INFO</TranslatedText></Text>
          <View style={styles.cardGroup}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}><TranslatedText>Full Name</TranslatedText></Text>
              <TextInput style={styles.rowInput} value={user.name} onChangeText={(v) => updateUser('name', v)} placeholder="John Doe" placeholderTextColor={COLORS.gray} />
            </View>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.rowLabel}><TranslatedText>Date of Birth</TranslatedText></Text>
              <View style={styles.rowValueContainer}>
                <Text style={[styles.rowValue, !patient.date_of_birth && { color: COLORS.lightGray }]}>{formatDateOfBirth(patient.date_of_birth)}</Text>
                <ChevronRight size={16} color={COLORS.lightGray} />
              </View>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => setShowGenderPicker(true)}>
              <Text style={styles.rowLabel}><TranslatedText>Gender</TranslatedText></Text>
              <View style={styles.rowValueContainer}>
                <Text style={[styles.rowValue, !patient.gender && { color: COLORS.lightGray }]}>{patient.gender || 'Select'}</Text>
                <ChevronRight size={16} color={COLORS.lightGray} />
              </View>
            </TouchableOpacity>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}><TranslatedText>Phone</TranslatedText></Text>
              <TextInput style={styles.rowInput} value={user.phone} onChangeText={(v) => updateUser('phone', v)} placeholder="+91 XXXXXXXXXX" placeholderTextColor={COLORS.gray} keyboardType="phone-pad" />
            </View>
            <View style={styles.divider} />
            <View style={styles.bioSection}>
              <Text style={styles.bioLabel}><TranslatedText>Bio</TranslatedText></Text>
              <TextInput
                style={styles.bioInput}
                value={user.bio || ''}
                onChangeText={(v) => updateUser('bio', v)}
                placeholder="Tell us a little about yourself..."
                placeholderTextColor={COLORS.gray}
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Group: Clinical */}
          <Text style={styles.groupHeader}><TranslatedText>CLINICAL INFO</TranslatedText></Text>
          <View style={styles.cardGroup}>
            <TouchableOpacity style={styles.row} onPress={() => setShowBloodGroupPicker(true)}>
              <Text style={styles.rowLabel}><TranslatedText>Blood Type</TranslatedText></Text>
              <View style={styles.rowValueContainer}>
                <Text style={[styles.rowValue, !patient.blood_group && { color: COLORS.lightGray }]}>{patient.blood_group || 'Select'}</Text>
                <ChevronRight size={16} color={COLORS.lightGray} />
              </View>
            </TouchableOpacity>
            <View style={styles.divider} />
            <View style={styles.tagSection}>
              <Text style={styles.tagSectionLabel}><TranslatedText>Chronic Conditions</TranslatedText></Text>
              <TagInput tags={patient.chronic_conditions} onChange={(t) => updatePatient('chronic_conditions', t)} placeholder="Asthma, Diabetes..." />
            </View>
            <View style={styles.divider} />
            <View style={styles.tagSection}>
              <Text style={styles.tagSectionLabel}><TranslatedText>Allergies</TranslatedText></Text>
              <TagInput tags={patient.allergies} onChange={(t) => updatePatient('allergies', t)} placeholder="Peanuts, Penicillin..." />
            </View>
            <View style={styles.divider} />
            <View style={styles.tagSection}>
              <Text style={styles.tagSectionLabel}><TranslatedText>Current Medications</TranslatedText></Text>
              <TagInput tags={patient.current_medications} onChange={(t) => updatePatient('current_medications', t)} placeholder="Metformin 500mg..." />
            </View>
          </View>

          {/* Group: Address */}
          <Text style={styles.groupHeader}><TranslatedText>ADDRESS</TranslatedText></Text>
          <View style={styles.cardGroup}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}><TranslatedText>Line 1</TranslatedText></Text>
              <TextInput 
                style={styles.rowInput} 
                value={patient.address_line1} 
                onChangeText={(v) => updatePatient('address_line1', v)} 
                placeholder="House/Flat No." 
                placeholderTextColor={COLORS.gray} 
                multiline
                scrollEnabled={false}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}><TranslatedText>Line 2</TranslatedText></Text>
              <TextInput 
                style={styles.rowInput} 
                value={patient.address_line2} 
                onChangeText={(v) => updatePatient('address_line2', v)} 
                placeholder="Street, Landmark" 
                placeholderTextColor={COLORS.gray} 
                multiline
                scrollEnabled={false}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}><TranslatedText>City</TranslatedText></Text>
              <TextInput style={styles.rowInput} value={patient.city} onChangeText={(v) => updatePatient('city', v)} placeholder="City" placeholderTextColor={COLORS.gray} />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}><TranslatedText>State</TranslatedText></Text>
              <TextInput style={styles.rowInput} value={patient.state} onChangeText={(v) => updatePatient('state', v)} placeholder="State" placeholderTextColor={COLORS.gray} />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}><TranslatedText>Pincode</TranslatedText></Text>
              <TextInput style={styles.rowInput} value={patient.postal_code} onChangeText={(v) => updatePatient('postal_code', v)} placeholder="Pincode" placeholderTextColor={COLORS.gray} keyboardType="number-pad" />
            </View>
          </View>

          {/* Group: Emergency */}
          <Text style={styles.groupHeader}><TranslatedText>EMERGENCY CONTACT</TranslatedText></Text>
          <View style={styles.cardGroup}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}><TranslatedText>Name</TranslatedText></Text>
              <TextInput style={styles.rowInput} value={patient.emergency_contact_name} onChangeText={(v) => updatePatient('emergency_contact_name', v)} placeholder="Contact Name" placeholderTextColor={COLORS.gray} />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}><TranslatedText>Relationship</TranslatedText></Text>
              <TextInput style={styles.rowInput} value={patient.emergency_contact_relationship} onChangeText={(v) => updatePatient('emergency_contact_relationship', v)} placeholder="e.g. Spouse" placeholderTextColor={COLORS.gray} />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}><TranslatedText>Phone</TranslatedText></Text>
              <TextInput style={styles.rowInput} value={patient.emergency_contact_phone} onChangeText={(v) => updatePatient('emergency_contact_phone', v)} placeholder="+91 XXXXXXXXXX" placeholderTextColor={COLORS.gray} keyboardType="phone-pad" />
            </View>
          </View>

          {/* Group: Preferences */}
          <Text style={styles.groupHeader}><TranslatedText>PREFERENCES</TranslatedText></Text>
          <TouchableOpacity 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              backgroundColor: COLORS.white, 
              marginHorizontal: 16, 
              borderRadius: 12, 
              paddingVertical: 12, 
              paddingHorizontal: 16, 
              marginBottom: 20 
            }} 
            onPress={() => setShowLanguagePicker(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Globe size={18} color={COLORS.text} />
              <Text style={{ fontSize: 15, fontFamily: FONTS.medium, color: COLORS.text }}>
                <TranslatedText>App Language</TranslatedText>
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 15, fontFamily: FONTS.regular, color: COLORS.gray }}>
                {localeInfo.native}
              </Text>
              <ChevronRight size={16} color={COLORS.lightGray} />
            </View>
          </TouchableOpacity>

          {/* Terms & Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.termsBox} onPress={() => setAgreedTerms(!agreedTerms)} activeOpacity={0.8}>
              <View style={[styles.checkbox, agreedTerms && styles.checkboxActive]}>
                {agreedTerms && <View style={styles.checkboxInner} />}
              </View>
              <Text style={styles.termsText}>I agree to the <Text style={styles.termsLink}>Terms & Privacy Policy</Text>.</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.saveButton, !agreedTerms && { opacity: 0.5 }]} onPress={handleSave} disabled={saving || !agreedTerms}>
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveButtonText}><TranslatedText>Save Profile</TranslatedText></Text>}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.logoutButton} 
              onPress={handleLogout} 
              disabled={signingOut}
              activeOpacity={0.7}
            >
              {signingOut ? (
                <ActivityIndicator size="small" color={COLORS.danger} />
              ) : (
                <View style={styles.logoutContent}>
                  <LogOut size={18} color={COLORS.danger} strokeWidth={2.2} />
                  <Text style={styles.logoutButtonText}><TranslatedText>Log Out</TranslatedText></Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals */}
      <AppDatePickerModal
        visible={showDatePicker}
        title="Date of Birth"
        value={patient.date_of_birth ? new Date(patient.date_of_birth) : new Date()}
        maximumDate={new Date()}
        onClose={() => setShowDatePicker(false)}
        onSelect={(selectedDate) => {
          updatePatient('date_of_birth', selectedDate.toISOString().split('T')[0]);
        }}
      />
      
      <Modal visible={showLanguagePicker} transparent animationType="slide" onRequestClose={() => setShowLanguagePicker(false)}>
        <View style={styles.modalOverlay}>
          <SafeAreaView edges={['bottom']} style={styles.pickerModal}>
            <View style={styles.modalHandle} />
            <Text style={styles.pickerTitle}><TranslatedText>Select Language</TranslatedText></Text>
            <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
              {locales.map((option) => {
                const active = option.code === locale;
                return (
                  <TouchableOpacity
                    key={option.code}
                    style={[styles.languageOption, active && styles.languageOptionActive]}
                    onPress={() => {
                      setLocale(option.code);
                      setShowLanguagePicker(false);
                    }}
                  >
                    <View style={styles.languageText}>
                      <Text style={[styles.languageNative, active && styles.languageTextActive]}>{option.native}</Text>
                      <Text style={styles.languageLabel}>{option.label}</Text>
                    </View>
                    {active && <Check size={20} color={COLORS.text} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowLanguagePicker(false)}>
              <Text style={styles.pickerCancelText}><TranslatedText>Done</TranslatedText></Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={showGenderPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowGenderPicker(false)}>
          <SafeAreaView edges={['bottom']} style={styles.pickerModal}>
            <Text style={styles.pickerTitle}><TranslatedText>Gender</TranslatedText></Text>
            {GENDER_OPTIONS.map((option) => (
              <TouchableOpacity key={option} style={styles.pickerOption} onPress={() => { updatePatient('gender', option); setShowGenderPicker(false); }}>
                <Text style={[styles.pickerOptionText, patient.gender === option && styles.pickerOptionSelected]}>{option}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowGenderPicker(false)}>
              <Text style={styles.pickerCancelText}><TranslatedText>Cancel</TranslatedText></Text>
            </TouchableOpacity>
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showBloodGroupPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowBloodGroupPicker(false)}>
          <SafeAreaView edges={['bottom']} style={styles.pickerModal}>
            <Text style={styles.pickerTitle}><TranslatedText>Blood Type</TranslatedText></Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
              {BLOOD_GROUP_OPTIONS.map((option) => (
                <TouchableOpacity key={option} style={[styles.pickerOption, { width: '45%' }]} onPress={() => { updatePatient('blood_group', option); setShowBloodGroupPicker(false); }}>
                  <Text style={[styles.pickerOptionText, patient.blood_group === option && styles.pickerOptionSelected]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowBloodGroupPicker(false)}>
              <Text style={styles.pickerCancelText}><TranslatedText>Cancel</TranslatedText></Text>
            </TouchableOpacity>
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 140 },
  
  avatarSection: { alignItems: 'center', marginVertical: 16 },
  avatarContainer: { position: 'relative', width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.white, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 48 },
  avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 48, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center' },
  cameraBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: COLORS.primary, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.background },
  userName: { fontSize: 24, color: COLORS.text, fontFamily: FONTS.bold, marginTop: 12, marginBottom: 2 },
  userEmail: { fontSize: 14, color: COLORS.gray, fontFamily: FONTS.medium },

  groupHeader: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.gray, marginLeft: 20, marginBottom: 4, marginTop: 4, letterSpacing: 1 },
  cardGroup: { backgroundColor: COLORS.white, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, minHeight: 60 },
  divider: { height: 1, backgroundColor: COLORS.background, marginLeft: 16 },
  rowLabel: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.text, width: 120 },
  rowInput: { flex: 1, fontSize: 15, fontFamily: FONTS.regular, color: COLORS.gray, textAlign: 'right', padding: 0 },
  rowValueContainer: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  rowValue: { fontSize: 15, fontFamily: FONTS.regular, color: COLORS.gray, marginRight: 8 },
  bioSection: { paddingVertical: 14, paddingHorizontal: 16 },
  bioLabel: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.text, marginBottom: 8 },
  bioInput: { fontSize: 15, fontFamily: FONTS.regular, color: COLORS.text, minHeight: 68, lineHeight: 22, padding: 0, textAlignVertical: 'top' },

  tagSection: { paddingVertical: 12 },
  tagSectionLabel: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.text, paddingHorizontal: 16, paddingTop: 12 },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  tagPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12 },
  tagText: { fontSize: 13, color: COLORS.text, fontFamily: FONTS.medium, marginRight: 4 },
  tagTextInput: { flex: 1, minWidth: 100, fontSize: 14, color: COLORS.gray, fontFamily: FONTS.regular, padding: 4 },

  footer: { marginTop: 16, paddingHorizontal: 16 },
  termsBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 24 },
  checkbox: { width: 20, height: 20, borderRadius: 12, borderWidth: 2, borderColor: COLORS.gray, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  checkboxInner: { width: 10, height: 10, borderRadius: 12, backgroundColor: COLORS.text },
  termsText: { fontSize: 13, color: COLORS.gray, fontFamily: FONTS.regular },
  termsLink: { fontFamily: FONTS.bold, color: COLORS.text },

  saveButton: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 12, justifyContent: 'center', paddingHorizontal: 16, minHeight: 48 },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontFamily: FONTS.bold , },

  logoutButton: { 
    backgroundColor: COLORS.white, 
    borderWidth: 1.5, 
    borderColor: '#FECACA', 
    paddingVertical: 14, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingHorizontal: 16, 
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutButtonText: { 
    color: COLORS.danger, 
    fontSize: 15, 
    fontFamily: FONTS.bold,
  },

  rowLeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabelInline: { width: 'auto', flex: 1 },

  languageList: { width: '100%', maxHeight: 400, alignSelf: 'center' },
  languageOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 6, backgroundColor: COLORS.background },
  languageOptionActive: { backgroundColor: COLORS.primaryLight },
  languageText: { flex: 1 },
  languageNative: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.text },
  languageLabel: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.gray, marginTop: 2 },
  languageTextActive: { fontFamily: FONTS.bold },
  modalHandle: { width: 40, height: 4, borderRadius: 12, backgroundColor: COLORS.lightGray, marginBottom: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerModal: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: 'center', paddingBottom: 40 },
  pickerTitle: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 20 },
  pickerOption: { paddingVertical: 12, width: '100%', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.background },
  pickerOptionText: { fontSize: 16, color: COLORS.text, fontFamily: FONTS.medium },
  pickerOptionSelected: { color: COLORS.primary, fontFamily: FONTS.bold },
  pickerCancel: { marginTop: 24, paddingVertical: 12, width: '100%', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12 },
  pickerCancelText: { color: COLORS.danger, fontFamily: FONTS.bold, fontSize: 16 },
});




