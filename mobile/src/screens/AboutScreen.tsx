import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'About'>;
};

type Language = 'ga' | 'en';

const content = {
  ga: {
    info: {
      title: 'Faisnéis',
      desc1: 'Is uirlis foghlama í seo chun cabhrú le daoine Gaeilge a fhoghlaim trí "oileáin líofachta" - bailiúcháin bheaga d\'abairtí úsáideacha faoi théamaí ar leith.',
      desc2: 'Cruthaigh d\'oileán féin, éist leis na habairtí, agus cleachtaigh an stór focal.',
    },
    howItWorks: {
      title: 'Cén chaoi a oibríonn sé?',
      desc1: 'Tá an aip seo bunaithe ar mhodh Boris Shekhtman (ón leabhar "How To Improve Your Foreign Language Immediately"). Is éard is "oileáin teanga" ann ná cainteanna réamhshainithe ar thopaicí coitianta - rudaí "ar féidir leat snámh chucu nuair a mhothaíonn tú go bhfuil tú ag bá i gcomhrá doiligh".',
      desc2: 'Trí abairtí a fhoghlaim de ghlanmheabhair:',
      bullets: ['• Tugann sé muinín duit', '• Ligeann sé scís meabhrach sa chomhrá', '• Foghlaímíonn tú gramadach go nádúrtha'],
      desc3: 'Cruthaigh oileáin faoi na topaicí a labhraíonn tú fúthu de ghnás - tusa féin, do chuid oibre, do chuid caitheamh aimsire, srl. Éist leofa arís agus arís eile go dtí go mbíonn siad de ghlanmheabhair agat!',
    },
    features: {
      title: 'Gnéithe',
      items: [
        'Cruthaigh oileáin le guth nó téacs',
        'Éist le Gaeilge Uladh/Mumhan',
        'Stór focal téamach',
        'Leathnaigh oileáin le habairtí nua',
      ],
    },
    credits: {
      title: 'Creidmheasanna',
      createdBy: 'Cruthaithe ag:',
    },
    tech: {
      title: 'Teicneolaíocht',
      items: [
        '• React Native & Expo',
        '• OpenAI GPT-4 & Whisper',
        '• Abair.ie (Sintéis Cainte)',
        '• Abair.ie (Aithint Cainte)',
      ],
    },
    footer: 'Go raibh maith agat as an aip seo a úsáid!',
  },
  en: {
    info: {
      title: 'About',
      desc1: 'This is a learning tool to help people learn Irish through "islands of fluency" - small collections of useful sentences about specific topics.',
      desc2: 'Create your own island, listen to the sentences, and practice the vocabulary.',
    },
    howItWorks: {
      title: 'How It Works',
      desc1: 'This app is based on Boris Shekhtman\'s method (from "How To Improve Your Foreign Language Immediately"). Language islands are pre-defined speeches on common topics - things "you can swim to when you feel as if you\'re drowning in a difficult conversation".',
      desc2: 'By memorizing these short paragraphs:',
      bullets: ['• You gain confidence in conversation', '• You get mental pauses during difficult exchanges', '• You learn grammar naturally in context'],
      desc3: 'Create islands about topics you normally talk about - yourself, your work, your hobbies, etc. Listen to them repeatedly until you know them by heart!',
    },
    features: {
      title: 'Features',
      items: [
        'Create islands with voice or text',
        'Listen to Munster/Ulster Irish',
        'Topic-specific vocabulary',
        'Expand islands with new sentences',
      ],
    },
    credits: {
      title: 'Credits',
      createdBy: 'Created by:',
    },
    tech: {
      title: 'Technology',
      items: [
        '• React Native & Expo',
        '• OpenAI GPT-4 & Whisper',
        '• Abair.ie (Speech Synthesis)',
        '• Abair.ie (Speech Recognition)',
      ],
    },
    footer: 'Thank you for using this app!',
  },
};

export function AboutScreen({ navigation }: Props) {
  const [language, setLanguage] = useState<Language>('ga');
  const t = content[language];

  const openGitHub = () => {
    Linking.openURL('https://github.com/seosamh');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Language Toggle */}
      <View style={styles.languageToggle}>
        <TouchableOpacity
          style={[styles.langButton, language === 'ga' && styles.langButtonActive]}
          onPress={() => setLanguage('ga')}
        >
          <Text style={[styles.langButtonText, language === 'ga' && styles.langButtonTextActive]}>
            Gaeilge
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langButton, language === 'en' && styles.langButtonActive]}
          onPress={() => setLanguage('en')}
        >
          <Text style={[styles.langButtonText, language === 'en' && styles.langButtonTextActive]}>
            English
          </Text>
        </TouchableOpacity>
      </View>

      {/* Logo/Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Ionicons name="leaf" size={80} color="#1a5f2a" />
        </View>
        <Text style={styles.appName}>An Chaothernach</Text>
        <Text style={styles.subtitle}>Oileáin Líofachta</Text>
        <Text style={styles.version}>v1.0.0</Text>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.info.title}</Text>
        <Text style={styles.description}>{t.info.desc1}</Text>
        <Text style={styles.description}>{t.info.desc2}</Text>
      </View>

      {/* How It Works */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.howItWorks.title}</Text>
        <Text style={styles.description}>{t.howItWorks.desc1}</Text>
        <Text style={styles.description}>{t.howItWorks.desc2}</Text>
        {t.howItWorks.bullets.map((bullet, i) => (
          <Text key={i} style={styles.bulletText}>{bullet}</Text>
        ))}
        <Text style={styles.description}>{t.howItWorks.desc3}</Text>
      </View>

      {/* Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.features.title}</Text>
        <View style={styles.featureList}>
          <View style={styles.feature}>
            <Ionicons name="mic" size={24} color="#1a5f2a" />
            <Text style={styles.featureText}>{t.features.items[0]}</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="volume-high" size={24} color="#1a5f2a" />
            <Text style={styles.featureText}>{t.features.items[1]}</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="book" size={24} color="#1a5f2a" />
            <Text style={styles.featureText}>{t.features.items[2]}</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="add-circle" size={24} color="#1a5f2a" />
            <Text style={styles.featureText}>{t.features.items[3]}</Text>
          </View>
        </View>
      </View>

      {/* Credits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.credits.title}</Text>
        <Text style={styles.creditText}>{t.credits.createdBy}</Text>
        <Text style={styles.authorName}>Seosamh Ó Cathail</Text>

        <TouchableOpacity style={styles.githubButton} onPress={openGitHub}>
          <Ionicons name="logo-github" size={24} color="#fff" />
          <Text style={styles.githubButtonText}>github.com/seosamh</Text>
        </TouchableOpacity>
      </View>

      {/* Technology */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.tech.title}</Text>
        {t.tech.items.map((item, i) => (
          <Text key={i} style={styles.techText}>{item}</Text>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t.footer}</Text>
        <Text style={styles.footerEmoji}>🇮🇪</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  languageToggle: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  langButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  langButtonActive: {
    backgroundColor: '#1a5f2a',
  },
  langButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a5f2a',
  },
  langButtonTextActive: {
    color: '#fff',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a5f2a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: '#999',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a5f2a',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 24,
    marginLeft: 8,
  },
  featureList: {
    gap: 16,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  creditText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
  },
  authorName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a5f2a',
    marginBottom: 16,
  },
  githubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#24292e',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 10,
  },
  githubButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  techText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 24,
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  footerEmoji: {
    fontSize: 48,
  },
});
