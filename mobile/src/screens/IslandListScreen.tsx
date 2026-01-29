import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { Island } from '../types/island';
import { storage } from '../services/storage';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'IslandList'>;
};

export function IslandListScreen({ navigation }: Props) {
  const [islands, setIslands] = useState<Island[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadIslands = useCallback(async () => {
    setLoading(true);
    try {
      const data = searchQuery
        ? await storage.searchIslands(searchQuery)
        : await storage.getAllIslands();
      setIslands(data);
    } catch (error) {
      console.error('Failed to load islands:', error);
    }
    setLoading(false);
  }, [searchQuery]);

  useFocusEffect(
    useCallback(() => {
      loadIslands();
    }, [loadIslands])
  );

  const handleDelete = (island: Island) => {
    Alert.alert(
      'Scrios an t-oileán?',
      `An bhfuil tú cinnte go dteastaíonn uait "${island.title}" a scriosadh?`,
      [
        { text: 'Ná scrios', style: 'cancel' },
        {
          text: 'Scrios',
          style: 'destructive',
          onPress: async () => {
            await storage.deleteIsland(island.id);
            loadIslands();
          },
        },
      ]
    );
  };

  const renderIsland = ({ item }: { item: Island }) => (
    <TouchableOpacity
      style={styles.islandCard}
      onPress={() => navigation.navigate('StudyIsland', { island: item })}
      onLongPress={() => handleDelete(item)}
    >
      <View style={styles.islandContent}>
        <Text style={styles.islandTitle}>{item.title}</Text>
        {item.titleIrish && (
          <Text style={styles.islandTitleIrish}>{item.titleIrish}</Text>
        )}
        <Text style={styles.islandDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={styles.islandMeta}>
          {item.sentences.length} abairt • {new Date(item.createdAt).toLocaleDateString('ga-IE')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#666" />
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="leaf-outline" size={80} color="#1a5f2a" />
      <Text style={styles.emptyTitle}>Níl aon oileáin agat fós</Text>
      <Text style={styles.emptySubtitle}>
        Cruthaigh d'oileán céad chun tús a chur le do chuid foghlama
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cuardaigh..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={loadIslands}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={islands}
        renderItem={renderIsland}
        keyExtractor={(item) => item.id}
        contentContainerStyle={islands.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmpty}
        refreshing={loading}
        onRefresh={loadIslands}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateIsland')}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  islandCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  islandContent: {
    flex: 1,
  },
  islandTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a5f2a',
    marginBottom: 4,
  },
  islandTitleIrish: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 4,
  },
  islandDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  islandMeta: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1a5f2a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
});
